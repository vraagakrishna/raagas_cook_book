import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  X,
  Mic,
  MicOff,
} from "lucide-react";
import { categories, ingredients, teachers } from "../services/catalogue";
import {
  getRecipeFileVersion,
  generateAvailableRecipeId,
  type RecipeImageUpload,
  saveCatalogueFile,
  saveIngredientToGitHub,
  saveIngredientImage,
  saveRecipeToGitHub,
} from "../services/githubRecipes";
import type {
  Difficulty,
  Ingredient,
  MasterRecord,
  Recipe,
  RecipeIngredient,
  RecipeStep,
} from "../types/models";
import { publicAssetUrl } from "../routing/publicAssetUrl";
import { appConfig } from "../config/appConfig";
import { ImageSourcePicker } from "./ImageSourcePicker";
import { closeOnBackdrop, useDialogDismiss } from "../hooks/useDialogDismiss";

export type RecipeEditorMode = "create" | "edit" | "duplicate";

interface RecipeEditorProps {
  mode: RecipeEditorMode;
  source?: Recipe;
  onCancel: () => void;
  onSaved: (recipe: Recipe) => void;
}

const imageLimits = {
  maxBytes: 3 * 1024 * 1024,
  maxWidth: 5000,
  maxHeight: 5000,
  maxPixels: 20_000_000,
};

const newStep = (): RecipeStep => ({
  id: crypto.randomUUID(),
  instruction: "",
});

const newIngredient = (): RecipeIngredient => ({
  ingredientId: "",
  quantity: "",
});

const emptyRecipe = (): Recipe => {
  const now = new Date().toISOString();
  return {
    id: "",
    name: "",
    categoryId: "",
    teacherId: "",
    servings: 0,
    difficulty: "",
    ingredients: [newIngredient()],
    steps: [newStep()],
    createdAt: now,
    updatedAt: now,
  };
};

const initialRecipe = (mode: RecipeEditorMode, source?: Recipe): Recipe => {
  if (!source || mode === "create") return emptyRecipe();
  if (mode === "edit") return structuredClone(source);
  const now = new Date().toISOString();
  return {
    ...structuredClone(source),
    id: "",
    name: `${source.name} (Copy)`,
    steps: source.steps.map((step) => ({
      ...step,
      id: crypto.randomUUID(),
    })),
    createdAt: now,
    updatedAt: now,
  };
};

const optionalMinutes = (value: string) => {
  if (value.trim() === "") return undefined;
  return Number(value);
};

const moveItem = <T,>(items: T[], index: number, direction: -1 | 1) => {
  const destination = index + direction;
  if (destination < 0 || destination >= items.length) return items;
  const next = [...items];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
};

const formatVoiceInstruction = (value: string) => {
  let formatted = value
    .replace(/\b(full stop|period)\b/gi, ".")
    .replace(/\bcomma\b/gi, ",")
    .replace(/\bquestion mark\b/gi, "?")
    .replace(/\bexclamation mark\b/gi, "!")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([,;!?])(?=\S)/g, "$1 ")
    .trim();
  if (!formatted) return "";
  formatted = formatted.charAt(0).toLocaleUpperCase() + formatted.slice(1);
  if (!/[.!?]$/.test(formatted)) formatted += ".";
  return formatted;
};

const validateImage = async (file: File): Promise<RecipeImageUpload> => {
  const extensions: Record<string, RecipeImageUpload["extension"]> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[file.type];
  if (!extension) throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size > imageLimits.maxBytes) {
    throw new Error("The cover image must be 3 MB or smaller.");
  }
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg =
    signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  const isPng =
    signature[0] === 0x89 &&
    signature[1] === 0x50 &&
    signature[2] === 0x4e &&
    signature[3] === 0x47 &&
    signature[4] === 0x0d &&
    signature[5] === 0x0a &&
    signature[6] === 0x1a &&
    signature[7] === 0x0a;
  const isWebp =
    String.fromCharCode(...signature.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
  if (
    (extension === "jpg" && !isJpeg) ||
    (extension === "png" && !isPng) ||
    (extension === "webp" && !isWebp)
  ) {
    throw new Error("The file contents do not match its image type.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("The selected file could not be decoded as an image.");
  }
  const invalidDimensions =
    bitmap.width > imageLimits.maxWidth ||
    bitmap.height > imageLimits.maxHeight ||
    bitmap.width * bitmap.height > imageLimits.maxPixels;
  bitmap.close();
  if (invalidDimensions) {
    throw new Error(
      "The cover image is too large. Use at most 5000 × 5000 pixels and 20 megapixels.",
    );
  }
  return { file, extension };
};

export function RecipeEditor({
  mode,
  source,
  onCancel,
  onSaved,
}: RecipeEditorProps) {
  const draftStorageKey = `raagas-recipe-draft:${mode}:${source?.id ?? "new"}`;
  const [draft, setDraft] = useState<Recipe>(() => {
    try {
      const saved = localStorage.getItem(draftStorageKey);
      return saved
        ? (JSON.parse(saved) as Recipe)
        : initialRecipe(mode, source);
    } catch {
      return initialRecipe(mode, source);
    }
  });
  const [expectedSha, setExpectedSha] = useState<string | null | undefined>(
    mode === "edit" ? undefined : null,
  );
  const [imageUpload, setImageUpload] = useState<RecipeImageUpload>();
  const [imagePreview, setImagePreview] = useState("");
  const [stepImageUploads, setStepImageUploads] = useState<
    Record<string, RecipeImageUpload>
  >({});
  const [stepImagePreviews, setStepImagePreviews] = useState<
    Record<string, string>
  >({});
  const [loadingVersion, setLoadingVersion] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [catalogueMode, setCatalogueMode] = useState<
    "ingredient" | "teacher" | "category" | null
  >(null);
  const [, refreshCatalogue] = useState(0);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const voiceStepRef = useRef<string | null>(null);
  const voiceWasListening = useRef(false);
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition({ clearTranscriptOnListen: true });

  useDialogDismiss(Boolean(catalogueMode), () => setCatalogueMode(null));

  useEffect(() => {
    if (listening) {
      voiceWasListening.current = true;
      if (voiceStepRef.current && transcript.trim()) {
        setDraft((current) => ({
          ...current,
          steps: current.steps.map((step) =>
            step.id === voiceStepRef.current
              ? { ...step, instruction: transcript }
              : step,
          ),
        }));
      }
      return;
    }
    const stepId = voiceStepRef.current;
    if (!stepId || !transcript.trim()) return;
    voiceWasListening.current = false;
    voiceStepRef.current = null;
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === stepId
          ? { ...step, instruction: formatVoiceInstruction(transcript) }
          : step,
      ),
    }));
  }, [listening, transcript]);

  const startStepVoice = (stepId: string) => {
    if (listening) {
      void SpeechRecognition.stopListening();
      return;
    }
    if (!browserSupportsSpeechRecognition) {
      setError("Voice recording is not supported in this browser.");
      return;
    }
    resetTranscript();
    voiceStepRef.current = stepId;
    setError("");
    void SpeechRecognition.startListening({
      continuous: false,
      language: "en-IN",
    }).catch(() => {
      voiceStepRef.current = null;
      setError("Voice recording could not start. Check microphone permission.");
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      /* storage may be unavailable */
    }
  }, [draft, draftStorageKey]);

  useEffect(() => {
    if (mode !== "edit" || !source) return;
    let cancelled = false;
    void getRecipeFileVersion(source.id)
      .then((version) => {
        if (cancelled) return;
        if (!version) {
          setError("This recipe no longer exists in the GitHub repository.");
          return;
        }
        setExpectedSha(version.sha);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load the recipe version from GitHub.",
          );
        }
      })
      .finally(() => !cancelled && setLoadingVersion(false));
    return () => {
      cancelled = true;
    };
  }, [mode, source]);

  useEffect(
    () => () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

  const totalDuration = useMemo(() => {
    const values = [
      draft.prepDurationMinutes,
      draft.waitingDurationMinutes,
      draft.cookDurationMinutes,
    ].filter((value): value is number => value != null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }, [
    draft.prepDurationMinutes,
    draft.waitingDurationMinutes,
    draft.cookDurationMinutes,
  ]);

  const update = <K extends keyof Recipe>(key: K, value: Recipe[K]) => (
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[String(key)];
      return next;
    }),
    setDraft((current) => ({ ...current, [key]: value }))
  );

  const clearFieldError = (field: string) =>
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

  const showFieldError = (field: string, message: string) => {
    setFieldErrors({ [field]: message });
    window.setTimeout(() => {
      const element = fieldRefs.current[field];
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.focus();
    }, 0);
  };

  const updateIngredient = (
    index: number,
    key: keyof RecipeIngredient,
    value: string,
  ) => (
    clearFieldError(`ingredients.${index}.${key}`),
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    }))
  );

  const updateStep = (index: number, instruction: string) => (
    clearFieldError(`steps.${index}`),
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, instruction } : step,
      ),
    }))
  );

  const chooseImage = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const validUpload = await validateImage(file);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageUpload(validUpload);
      setImagePreview(URL.createObjectURL(file));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not use that image.",
      );
    }
  };

  const chooseStepImage = async (stepId: string, file?: File) => {
    if (!file) return;
    setError("");
    try {
      const upload = await validateImage(file);
      setStepImageUploads((current) => ({ ...current, [stepId]: upload }));
      setStepImagePreviews((current) => {
        if (current[stepId]) URL.revokeObjectURL(current[stepId]);
        return { ...current, [stepId]: URL.createObjectURL(file) };
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not use that step image.",
      );
    }
  };

  const validate = (): { field: string; message: string } | null => {
    if (!draft.name.trim())
      return { field: "name", message: "Enter a recipe name." };
    if (!categories.some((item) => item.id === draft.categoryId))
      return { field: "categoryId", message: "Choose a valid category." };
    if (!teachers.some((item) => item.id === draft.teacherId))
      return { field: "teacherId", message: "Choose a valid teacher." };
    if (!draft.difficulty)
      return { field: "difficulty", message: "Choose a difficulty." };
    if (!Number.isInteger(draft.servings) || draft.servings <= 0)
      return {
        field: "servings",
        message: "Servings must be a positive whole number.",
      };
    for (const [field, value] of [
      ["prepDurationMinutes", draft.prepDurationMinutes],
      ["waitingDurationMinutes", draft.waitingDurationMinutes],
      ["cookDurationMinutes", draft.cookDurationMinutes],
    ] as const) {
      if (value != null && (!Number.isFinite(value) || value < 0))
        return { field, message: "Durations must be zero or greater." };
    }
    if (!draft.ingredients.length)
      return { field: "ingredients", message: "Add at least one ingredient." };
    const invalidIngredient = draft.ingredients.findIndex(
      (entry) => !entry.ingredientId || !entry.quantity.trim(),
    );
    if (invalidIngredient >= 0)
      return {
        field: !draft.ingredients[invalidIngredient].ingredientId
          ? `ingredients.${invalidIngredient}.ingredientId`
          : `ingredients.${invalidIngredient}.quantity`,
        message: "Choose an ingredient and enter a quantity for every row.",
      };
    const seenIngredients = new Set<string>();
    const duplicateIngredient = draft.ingredients.findIndex((entry) => {
      if (seenIngredients.has(entry.ingredientId)) return true;
      seenIngredients.add(entry.ingredientId);
      return false;
    });
    if (duplicateIngredient >= 0)
      return {
        field: `ingredients.${duplicateIngredient}.ingredientId`,
        message: "The same ingredient is listed more than once.",
      };
    const emptyStep = draft.steps.findIndex((step) => !step.instruction.trim());
    if (!draft.steps.length || emptyStep >= 0)
      return {
        field: draft.steps.length ? `steps.${emptyStep}` : "steps",
        message: "Enter an instruction for every preparation step.",
      };
    return null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const validationError = validate();
    if (validationError) {
      setError(validationError.message);
      showFieldError(validationError.field, validationError.message);
      return;
    }
    if (expectedSha === undefined) {
      setError("Wait for the current GitHub version to finish loading.");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const recipeId =
        mode === "edit" ? draft.id : await generateAvailableRecipeId();
      const recipe: Recipe = {
        ...draft,
        id: recipeId,
        name: draft.name.trim(),
        nickname: draft.nickname?.trim() || undefined,
        totalDurationMinutes: totalDuration ?? undefined,
        ingredients: draft.ingredients.map((entry) => ({
          ingredientId: entry.ingredientId,
          quantity: entry.quantity.trim(),
          note: entry.note?.trim() || undefined,
        })),
        steps: draft.steps.map((step) => ({
          ...step,
          instruction: step.instruction.trim(),
        })),
        updatedAt: now,
        createdAt: mode === "edit" ? draft.createdAt : draft.createdAt || now,
      };
      const saved = await saveRecipeToGitHub({
        recipe,
        expectedSha,
        imageUpload,
        stepImageUploads,
      });
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {
        /* ignore */
      }
      setSuccess("Saved to GitHub. The public deployment will update shortly.");
      window.setTimeout(() => onSaved(saved), 650);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The recipe could not be saved.",
      );
      setSaving(false);
    }
  };

  const clearDraft = () => {
    if (!window.confirm("Clear all fields in this recipe form?")) return;
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      /* ignore */
    }
    setDraft(initialRecipe(mode, source));
    setFieldErrors({});
    setError("");
  };

  return (
    <main className="recipe-editor-page">
      <div className="editor-heading">
        <button className="editor-back" onClick={onCancel} disabled={saving}>
          <ArrowLeft size={17} /> Cancel
        </button>
        <div>
          <span className="kicker">OWNER RECIPE STUDIO</span>
          <h1>
            {mode === "create"
              ? "Add a new recipe"
              : mode === "duplicate"
                ? "Review duplicated recipe"
                : `Edit ${source?.name ?? "recipe"}`}
          </h1>
          <p>
            {mode === "duplicate"
              ? "This is a separate recipe with a new ID. Review it before saving."
              : "Complete the fields below, then save the JSON directly to GitHub."}
          </p>
        </div>
      </div>

      <form className="recipe-editor" onSubmit={submit}>
        {catalogueMode && (
          <div
            className="catalogue-dialog-backdrop"
            role="presentation"
            onMouseDown={(event) =>
              closeOnBackdrop(event, () => setCatalogueMode(null))
            }
          >
            <CatalogueManager
              mode={catalogueMode}
              onClose={() => setCatalogueMode(null)}
              onSaved={(record) => {
                if (catalogueMode === "ingredient") {
                  ingredients.push(record as Ingredient);
                  setDraft((current) => ({
                    ...current,
                    ingredients: current.ingredients.some(
                      (entry) => !entry.ingredientId,
                    )
                      ? current.ingredients.map((entry) =>
                          entry.ingredientId
                            ? entry
                            : { ...entry, ingredientId: record.id },
                        )
                      : [
                          ...current.ingredients,
                          { ingredientId: record.id, quantity: "" },
                        ],
                  }));
                } else if (catalogueMode === "teacher") {
                  teachers.push(record as MasterRecord);
                  update("teacherId", record.id);
                } else {
                  categories.push(record as MasterRecord);
                  update("categoryId", record.id);
                }
                refreshCatalogue((value) => value + 1);
                setCatalogueMode(null);
              }}
            />
          </div>
        )}
        <section className="editor-section">
          <div className="editor-section-title">
            <span>01</span>
            <div>
              <h2>Recipe details</h2>
              <p>The information shown on recipe cards and the detail page.</p>
            </div>
          </div>
          <div className="editor-grid">
            <label className="field-wide">
              <span>Recipe name *</span>
              <input
                ref={(element) => {
                  fieldRefs.current.name = element;
                }}
                value={draft.name}
                onChange={(event) => {
                  clearFieldError("name");
                  update("name", event.target.value);
                }}
                disabled={saving}
              />
              {fieldErrors.name && (
                <small className="field-error">{fieldErrors.name}</small>
              )}
            </label>
            <label className="field-wide">
              <span>Nickname</span>
              <input
                value={draft.nickname ?? ""}
                onChange={(event) => update("nickname", event.target.value)}
                placeholder="Optional family nickname"
                disabled={saving}
              />
            </label>
            <label>
              <span>Category *</span>
              <SearchableSelect
                inputRef={(element) => {
                  fieldRefs.current.categoryId = element;
                }}
                value={draft.categoryId}
                options={categories.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={(value) => {
                  clearFieldError("categoryId");
                  update("categoryId", value);
                }}
                placeholder="Search category"
                disabled={saving}
              />
              <button
                type="button"
                className="catalogue-add-link"
                onClick={() => setCatalogueMode("category")}
                disabled={saving}
              >
                <Plus size={13} /> Add category
              </button>
              {fieldErrors.categoryId && (
                <small className="field-error">{fieldErrors.categoryId}</small>
              )}
            </label>
            <label>
              <span>Taught by *</span>
              <SearchableSelect
                inputRef={(element) => {
                  fieldRefs.current.teacherId = element;
                }}
                value={draft.teacherId}
                options={teachers.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={(value) => {
                  clearFieldError("teacherId");
                  update("teacherId", value);
                }}
                placeholder="Search teacher"
                disabled={saving}
              />
              <button
                type="button"
                className="catalogue-add-link"
                onClick={() => setCatalogueMode("teacher")}
                disabled={saving}
              >
                <Plus size={13} /> Add teacher
              </button>
              {fieldErrors.teacherId && (
                <small className="field-error">{fieldErrors.teacherId}</small>
              )}
            </label>
            <label>
              <span>Servings *</span>
              <input
                ref={(element) => {
                  fieldRefs.current.servings = element;
                }}
                type="number"
                min="1"
                step="1"
                value={draft.servings || ""}
                onChange={(event) => {
                  clearFieldError("servings");
                  update("servings", Number(event.target.value));
                }}
                disabled={saving}
              />
              {fieldErrors.servings && (
                <small className="field-error">{fieldErrors.servings}</small>
              )}
            </label>
            <label>
              <span>Difficulty *</span>
              <SearchableSelect
                inputRef={(element) => {
                  fieldRefs.current.difficulty = element;
                }}
                value={draft.difficulty}
                options={[
                  { value: "easy", label: "Easy" },
                  { value: "medium", label: "Medium" },
                  { value: "hard", label: "Hard" },
                ]}
                onChange={(value) => {
                  clearFieldError("difficulty");
                  update("difficulty", value as Difficulty);
                }}
                placeholder="Search difficulty"
                disabled={saving}
              />
              {fieldErrors.difficulty && (
                <small className="field-error">{fieldErrors.difficulty}</small>
              )}
            </label>
            <label className="featured-field">
              <input
                type="checkbox"
                checked={draft.featured ?? false}
                onChange={(event) => update("featured", event.target.checked)}
                disabled={saving}
              />
              <span>Show as a family favourite</span>
            </label>
          </div>
        </section>

        <section className="editor-section">
          <div className="editor-section-title">
            <span>02</span>
            <div>
              <h2>Cover image</h2>
              <p>Optional. Upload a photo or take one on a supported device.</p>
            </div>
          </div>
          <div className="cover-editor">
            {(imagePreview || draft.coverImage) && (
              <img
                src={imagePreview || publicAssetUrl(draft.coverImage!)}
                alt="Recipe cover preview"
              />
            )}
            <div>
              <ImageSourcePicker
                onFile={(file) => void chooseImage(file)}
                disabled={saving}
              />
              <small>JPEG, PNG or WebP · maximum 3 MB</small>
              {(imagePreview || draft.coverImage) && (
                <button
                  type="button"
                  className="remove-image"
                  onClick={() => {
                    if (imagePreview) URL.revokeObjectURL(imagePreview);
                    setImagePreview("");
                    setImageUpload(undefined);
                    update("coverImage", undefined);
                  }}
                  disabled={saving}
                >
                  <X size={14} /> Remove cover
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="editor-section">
          <div className="editor-section-title">
            <span>03</span>
            <div>
              <h2>Timing</h2>
              <p>
                All durations are optional. Total:{" "}
                {totalDuration ?? "Not defined"}
                {totalDuration != null ? " min" : ""}
              </p>
            </div>
          </div>
          <div className="duration-grid">
            {[
              ["prepDurationMinutes", "Preparation"],
              ["waitingDurationMinutes", "Waiting / resting"],
              ["cookDurationMinutes", "Cooking"],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <div>
                  <input
                    ref={(element) => {
                      fieldRefs.current[key] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    placeholder="Optional"
                    value={
                      (draft[key as keyof Recipe] as number | undefined) ?? ""
                    }
                    onChange={(event) => {
                      clearFieldError(key);
                      update(
                        key as
                          | "prepDurationMinutes"
                          | "waitingDurationMinutes"
                          | "cookDurationMinutes",
                        optionalMinutes(event.target.value),
                      );
                    }}
                    disabled={saving}
                  />
                  <span>minutes</span>
                </div>
                {fieldErrors[key] && (
                  <small className="field-error">{fieldErrors[key]}</small>
                )}
              </label>
            ))}
          </div>
        </section>

        <section className="editor-section">
          <div className="editor-section-title">
            <span>04</span>
            <div>
              <h2>Ingredients</h2>
              <p>
                Select from the shared ingredient catalogue and keep the desired
                order.
              </p>
            </div>
          </div>
          <div className="editor-rows">
            {draft.ingredients.map((entry, index) => (
              <div
                className="ingredient-editor-row"
                key={`${index}-${entry.ingredientId}`}
              >
                <span className="row-number">{index + 1}</span>
                <label>
                  <span>Ingredient</span>
                  <SearchableSelect
                    inputRef={(element) => {
                      fieldRefs.current[`ingredients.${index}.ingredientId`] =
                        element;
                    }}
                    value={entry.ingredientId}
                    options={ingredients.map((item) => ({
                      value: item.id,
                      label: item.english,
                      detail: item.teluguInEnglish,
                    }))}
                    onChange={(value) =>
                      updateIngredient(index, "ingredientId", value)
                    }
                    placeholder="Search ingredient"
                    disabled={saving}
                  />
                  {fieldErrors[`ingredients.${index}.ingredientId`] && (
                    <small className="field-error">
                      {fieldErrors[`ingredients.${index}.ingredientId`]}
                    </small>
                  )}
                </label>
                <label>
                  <span>Quantity</span>
                  <input
                    ref={(element) => {
                      fieldRefs.current[`ingredients.${index}.quantity`] =
                        element;
                    }}
                    value={entry.quantity}
                    onChange={(event) =>
                      updateIngredient(index, "quantity", event.target.value)
                    }
                    placeholder="e.g. 2 medium"
                    disabled={saving}
                  />
                  {fieldErrors[`ingredients.${index}.quantity`] && (
                    <small className="field-error">
                      {fieldErrors[`ingredients.${index}.quantity`]}
                    </small>
                  )}
                </label>
                <label>
                  <span>Preparation note</span>
                  <input
                    value={entry.note ?? ""}
                    onChange={(event) =>
                      updateIngredient(index, "note", event.target.value)
                    }
                    placeholder="Optional"
                    disabled={saving}
                  />
                </label>
                <RowActions
                  index={index}
                  length={draft.ingredients.length}
                  disabled={saving}
                  onMove={(direction) =>
                    setDraft((current) => ({
                      ...current,
                      ingredients: moveItem(
                        current.ingredients,
                        index,
                        direction,
                      ),
                    }))
                  }
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      ingredients: current.ingredients.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="add-row-button"
            ref={(element) => {
              fieldRefs.current.ingredients = element;
            }}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                ingredients: [...current.ingredients, newIngredient()],
              }))
            }
            disabled={saving}
          >
            <Plus size={16} /> Add ingredient
          </button>
          {fieldErrors.ingredients && (
            <small className="field-error">{fieldErrors.ingredients}</small>
          )}
          <button
            type="button"
            className="catalogue-add-link"
            onClick={() => setCatalogueMode("ingredient")}
            disabled={saving}
          >
            <Plus size={13} /> Create a new ingredient
          </button>
        </section>

        <section className="editor-section">
          <div className="editor-section-title">
            <span>05</span>
            <div>
              <h2>Method</h2>
              <p>Add, remove and reorder the preparation steps.</p>
            </div>
          </div>
          <div className="editor-rows">
            {draft.steps.map((step, index) => (
              <div className="step-editor-row" key={step.id}>
                <span className="row-number">{index + 1}</span>
                <label>
                  <span className="step-instruction-label">
                    <span>Instruction</span>
                    <button
                      type="button"
                      className={
                        listening && voiceStepRef.current === step.id
                          ? "step-voice-button listening"
                          : "step-voice-button"
                      }
                      onClick={() => startStepVoice(step.id)}
                      disabled={
                        saving ||
                        (listening && voiceStepRef.current !== step.id)
                      }
                      aria-label={
                        listening && voiceStepRef.current === step.id
                          ? `Stop recording step ${index + 1}`
                          : `Record step ${index + 1} by voice`
                      }
                    >
                      {listening && voiceStepRef.current === step.id ? (
                        <MicOff size={14} />
                      ) : (
                        <Mic size={14} />
                      )}
                      {listening && voiceStepRef.current === step.id
                        ? "Stop recording"
                        : "Voice record"}
                    </button>
                  </span>
                  <textarea
                    ref={(element) => {
                      fieldRefs.current[`steps.${index}`] = element;
                    }}
                    value={step.instruction}
                    onChange={(event) => updateStep(index, event.target.value)}
                    rows={3}
                    disabled={saving}
                  />
                  {fieldErrors[`steps.${index}`] && (
                    <small className="field-error">
                      {fieldErrors[`steps.${index}`]}
                    </small>
                  )}
                </label>
                <div className="step-image-editor">
                  {(stepImagePreviews[step.id] || step.image) && (
                    <img
                      src={
                        stepImagePreviews[step.id] ||
                        publicAssetUrl(step.image!)
                      }
                      alt={`Step ${index + 1} preview`}
                    />
                  )}
                  <ImageSourcePicker
                    compact
                    onFile={(file) => void chooseStepImage(step.id, file)}
                    disabled={saving}
                  />
                </div>
                <RowActions
                  index={index}
                  length={draft.steps.length}
                  disabled={saving}
                  onMove={(direction) =>
                    setDraft((current) => ({
                      ...current,
                      steps: moveItem(current.steps, index, direction),
                    }))
                  }
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      steps: current.steps.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="add-row-button"
            ref={(element) => {
              fieldRefs.current.steps = element;
            }}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                steps: [...current.steps, newStep()],
              }))
            }
            disabled={saving}
          >
            <Plus size={16} /> Add step
          </button>
          {fieldErrors.steps && (
            <small className="field-error">{fieldErrors.steps}</small>
          )}
          <label className="recipe-note-field">
            <span>Raaga&apos;s note</span>
            <textarea
              value={draft.note ?? ""}
              onChange={(event) => update("note", event.target.value)}
              rows={3}
              placeholder="A personal note for this recipe"
              disabled={saving}
            />
          </label>
        </section>

        <div className="editor-save-bar">
          <button
            type="button"
            className="clear-draft-button"
            onClick={clearDraft}
            disabled={saving}
          >
            Clear form
          </button>
          <div aria-live="polite">
            {error && <p className="editor-error">{error}</p>}
            {success && <p className="editor-success">{success}</p>}
            {!error && !success && (
              <p>
                Saving creates a commit on {appConfig.github.repositoryBranch}{" "}
                and starts the normal Pages deployment.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={saving || loadingVersion || expectedSha === undefined}
          >
            {saving || loadingVersion ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            {loadingVersion
              ? "Loading version…"
              : saving
                ? "Saving to GitHub…"
                : "Save recipe"}
          </button>
        </div>
      </form>
    </main>
  );
}

function CatalogueManager({
  mode,
  onClose,
  onSaved,
}: {
  mode: "ingredient" | "teacher" | "category";
  onClose: () => void;
  onSaved: (record: Ingredient | MasterRecord) => void;
}) {
  const [name, setName] = useState("");
  const [telugu, setTelugu] = useState("");
  const [transliteration, setTransliteration] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const transliterationInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [errorField, setErrorField] = useState<
    "name" | "transliteration" | "image" | null
  >(null);
  const label = mode === "ingredient" ? "ingredient" : mode;
  const readImage = (file?: File) => {
    if (!file) return;
    setImageFile(file);
    setError("");
    setErrorField(null);
  };

  const submitCatalogue = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(`Enter a ${label} name.`);
      setErrorField("name");
      nameInputRef.current?.focus();
      return;
    }
    if (mode === "ingredient" && telugu.trim() && !transliteration.trim()) {
      setError("Enter the Telugu name in English so it can be read.");
      setErrorField("transliteration");
      transliterationInputRef.current?.focus();
      return;
    }
    const list =
      mode === "ingredient"
        ? ingredients
        : mode === "teacher"
          ? teachers
          : categories;
    const duplicate =
      mode === "ingredient"
        ? ingredients.some(
            (item) =>
              item.english.toLocaleLowerCase() ===
              trimmedName.toLocaleLowerCase(),
          )
        : (list as MasterRecord[]).some(
            (item) =>
              item.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
          );
    if (duplicate) {
      setError(`That ${label} already exists.`);
      setErrorField("name");
      nameInputRef.current?.focus();
      return;
    }
    const prefix =
      mode === "ingredient" ? "ing" : mode === "teacher" ? "teacher" : "cat";
    const id = `${prefix}-${trimmedName
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
    let image: string | undefined;
    if (mode === "ingredient" && imageFile) {
      try {
        image = await saveIngredientImage(id, imageFile, trimmedName);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not upload this image.",
        );
        setErrorField("image");
        imageInputRef.current?.focus();
        return;
      }
    }
    const record: Ingredient | MasterRecord =
      mode === "ingredient"
        ? {
            id,
            english: trimmedName,
            ...(telugu.trim() ? { telugu: telugu.trim() } : {}),
            ...(transliteration.trim()
              ? { teluguInEnglish: transliteration.trim() }
              : {}),
            ...(image ? { image } : {}),
          }
        : { id, name: trimmedName };
    setSaving(true);
    try {
      const records = [...list, record];
      if (mode === "ingredient") {
        await saveIngredientToGitHub(
          record,
          JSON.stringify(record, null, 2),
          `Add ingredient: ${trimmedName}`,
        );
      } else {
        await saveCatalogueFile(
          mode === "teacher" ? "teachers" : "categories",
          records,
          `Add ${label}: ${trimmedName}`,
        );
      }
      onSaved(record);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `Could not save this ${label}.`,
      );
      setErrorField("name");
      setSaving(false);
      nameInputRef.current?.focus();
    }
  };

  return (
    <section className="catalogue-manager editor-section">
      <div className="editor-section-title">
        <span>+</span>
        <div>
          <h2>Add {label}</h2>
          <p>
            This is saved to the shared GitHub catalogue before returning to the
            recipe.
          </p>
        </div>
      </div>
      <div className="catalogue-form">
        <label>
          <span>{mode === "ingredient" ? "English name" : "Name"} *</span>
          <input
            ref={nameInputRef}
            value={name}
            className={errorField === "name" ? "input-error" : ""}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
              setErrorField(null);
            }}
            autoFocus
            disabled={saving}
          />
          {error && errorField === "name" && (
            <small className="field-error">{error}</small>
          )}
        </label>
        {mode === "ingredient" && (
          <>
            <label>
              <span>Telugu name</span>
              <input
                value={telugu}
                onChange={(event) => {
                  setTelugu(event.target.value);
                  if (
                    !event.target.value.trim() &&
                    errorField === "transliteration"
                  ) {
                    setError("");
                    setErrorField(null);
                  }
                }}
                placeholder="Example: పచ్చి మిరపకాయ"
                disabled={saving}
              />
            </label>
            <label>
              <span>Telugu in English{telugu.trim() ? " *" : ""}</span>
              <input
                ref={transliterationInputRef}
                value={transliteration}
                required={Boolean(telugu.trim())}
                aria-required={Boolean(telugu.trim())}
                className={
                  errorField === "transliteration" ? "input-error" : ""
                }
                onChange={(event) => {
                  setTransliteration(event.target.value);
                  setError("");
                  setErrorField(null);
                }}
                placeholder="Example: Pachchi mirapakaaya"
                disabled={saving}
              />
              {error && errorField === "transliteration" && (
                <small className="field-error">{error}</small>
              )}
            </label>
            <div className="catalogue-image-field">
              <span>Ingredient image</span>
              <div
                ref={(element) => {
                  imageInputRef.current =
                    element?.querySelector("input[type=file]") ?? null;
                }}
              >
                <ImageSourcePicker
                  compact
                  onFile={readImage}
                  disabled={saving}
                />
              </div>
              {error && errorField === "image" && (
                <small className="field-error">{error}</small>
              )}
            </div>
          </>
        )}
        <div className="catalogue-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            <X size={15} /> Cancel
          </button>
          <button
            type="button"
            onClick={() => void submitCatalogue()}
            disabled={saving}
          >
            {saving ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Save size={15} />
            )}{" "}
            Save {label}
          </button>
        </div>
      </div>
    </section>
  );
}

function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  inputRef,
}: {
  value: string;
  options: Array<{ value: string; label: string; detail?: string }>;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  inputRef?: (element: HTMLInputElement | null) => void;
}) {
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useRef(`searchable-options-${crypto.randomUUID()}`).current;
  useEffect(() => {
    if (!open) setQuery(selected?.label ?? "");
  }, [selected?.label, open]);
  const matches = options.filter((option) =>
    `${option.label} ${option.detail ?? ""}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  useEffect(() => setActiveIndex(0), [query, open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${listId}-${activeIndex}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId, open]);
  return (
    <div className={open ? "searchable-select open" : "searchable-select"}>
      <input
        ref={inputRef}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "ArrowDown" && open) {
            event.preventDefault();
            setActiveIndex((current) =>
              Math.min(current + 1, Math.max(matches.length - 1, 0)),
            );
          }
          if (event.key === "ArrowUp" && open) {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter" && open && matches[activeIndex]) {
            event.preventDefault();
            onChange(matches[activeIndex].value);
            setQuery(matches[activeIndex].label);
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          open && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined
        }
      />
      <span className="searchable-select-arrow" aria-hidden="true">
        ⌄
      </span>
      {open && (
        <div className="searchable-select-menu" role="listbox" id={listId}>
          {matches.length ? (
            matches.map((option, optionIndex) => (
              <div
                key={option.value}
                id={`${listId}-${optionIndex}`}
                role="option"
                aria-selected={option.value === value}
                className={
                  optionIndex === activeIndex
                    ? "highlighted"
                    : option.value === value
                      ? "selected"
                      : ""
                }
                onMouseEnter={() => setActiveIndex(optionIndex)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option.value);
                  setQuery(option.label);
                  setOpen(false);
                }}
              >
                <strong>{option.label}</strong>
                {option.detail && <small>{option.detail}</small>}
              </div>
            ))
          ) : (
            <p>No matching options</p>
          )}
        </div>
      )}
    </div>
  );
}

function RowActions({
  index,
  length,
  disabled,
  onMove,
  onRemove,
}: {
  index: number;
  length: number;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="row-actions">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={disabled || index === 0}
        aria-label="Move up"
      >
        <ArrowUp size={15} />
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={disabled || index === length - 1}
        aria-label="Move down"
      >
        <ArrowDown size={15} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove row"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
