import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Pencil,
  Plus,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import {
  categories,
  ingredients,
  teachers,
  recipes,
} from "../services/catalogue";
import {
  saveCatalogueFile,
  deleteIngredientFromGitHub,
  saveIngredientImage,
  saveIngredientToGitHub,
  type CatalogueFile,
} from "../services/githubRecipes";
import type { Ingredient, MasterRecord } from "../types/models";
import { publicAssetUrl } from "../routing/publicAssetUrl";
import { ImageSourcePicker } from "./ImageSourcePicker";
import { closeOnBackdrop, useDialogDismiss } from "../hooks/useDialogDismiss";
import { ingredientPronunciationPath } from "../services/pronunciation";

type Kind = CatalogueFile;
const lists = { ingredients, teachers, categories };

export function CataloguePage({ onBack }: { onBack: () => void }) {
  const [kind, setKind] = useState<Kind>("ingredients");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<
    "name" | "telugu" | "transliteration" | "image" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<
    Ingredient | MasterRecord | null
  >(null);
  const [newEnglish, setNewEnglish] = useState("");
  const [newTelugu, setNewTelugu] = useState("");
  const [newTransliteration, setNewTransliteration] = useState("");
  const [newImage, setNewImage] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const teluguInputRef = useRef<HTMLInputElement | null>(null);
  const transliterationInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  useDialogDismiss(dialogOpen, () => setDialogOpen(false));
  const records = lists[kind] as (Ingredient | MasterRecord)[];
  const visible = records.filter((record) =>
    ("english" in record ? record.english : record.name)
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / itemsPerPage));
  const pageRecords = visible.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );
  useEffect(() => {
    setPage(1);
  }, [kind, search]);
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);
  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
    window.setTimeout(
      () =>
        document
          .querySelector(".catalogue-list")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };
  const nameOf = (record: Ingredient | MasterRecord) =>
    "english" in record ? record.english : record.name;
  const readImage = (file?: File) => {
    if (!file) return;
    setNewImageFile(file);
    setNewImage(URL.createObjectURL(file));
    setError("");
    setErrorField(null);
  };
  const catalogueLabel =
    kind === "ingredients"
      ? "ingredient"
      : kind === "teachers"
        ? "teacher"
        : "category";
  const save = async (
    next: (Ingredient | MasterRecord)[],
    commitMessage: string,
  ) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (kind === "ingredients") {
        const currentById = new Map(
          records.map((record) => [record.id, record]),
        );
        const nextById = new Map(next.map((record) => [record.id, record]));
        const addedOrEdited = next.find((record) => {
          const previous = currentById.get(record.id);
          return (
            !previous || JSON.stringify(previous) !== JSON.stringify(record)
          );
        });
        const removed = records.find((record) => !nextById.has(record.id));
        if (addedOrEdited) {
          await saveIngredientToGitHub(
            addedOrEdited,
            JSON.stringify(addedOrEdited, null, 2),
            commitMessage,
          );
        } else if (removed) {
          await deleteIngredientFromGitHub(removed.id, commitMessage);
        }
      } else {
        await saveCatalogueFile(kind, next, commitMessage);
      }
      records.splice(0, records.length, ...next);
      setMessage("Saved to GitHub.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save catalogue.");
      setErrorField("name");
      return false;
    } finally {
      setSaving(false);
    }
  };
  const openDialog = (record?: Ingredient | MasterRecord) => {
    setMessage("");
    setEditingRecord(record ?? null);
    if (record && "english" in record) {
      setNewEnglish(record.english);
      setNewTelugu(record.telugu ?? "");
      setNewTransliteration(record.teluguInEnglish ?? "");
      setNewImage(record.image ?? "");
      setNewImageFile(null);
    } else if (record) {
      setNewEnglish(record.name);
      setNewTelugu("");
      setNewTransliteration("");
      setNewImage("");
      setNewImageFile(null);
    } else {
      setNewEnglish("");
      setNewTelugu("");
      setNewTransliteration("");
      setNewImage("");
      setNewImageFile(null);
    }
    setError("");
    setErrorField(null);
    setDialogOpen(true);
  };
  const saveDialog = async () => {
    const value = newEnglish.trim();
    if (!value) {
      setError("Enter a name first.");
      setErrorField("name");
      nameInputRef.current?.focus();
      return;
    }
    if (kind === "ingredients" && !newTelugu.trim()) {
      setError("Enter the ingredient name in Telugu.");
      setErrorField("telugu");
      teluguInputRef.current?.focus();
      return;
    }
    if (kind === "ingredients" && !newTransliteration.trim()) {
      setError("Enter the Telugu name in English so it can be read.");
      setErrorField("transliteration");
      transliterationInputRef.current?.focus();
      return;
    }
    if (
      records.some(
        (r) =>
          r.id !== editingRecord?.id &&
          nameOf(r).toLocaleLowerCase() === value.toLocaleLowerCase(),
      )
    ) {
      setError("That entry already exists.");
      setErrorField("name");
      nameInputRef.current?.focus();
      return;
    }
    const id =
      editingRecord?.id ??
      kind.slice(0, -1) +
        "-" +
        value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-") +
        "-" +
        crypto.randomUUID().slice(0, 6);
    setSaving(true);
    let image = newImage.trim() || undefined;
    if (kind === "ingredients" && newImageFile) {
      try {
        image = await saveIngredientImage(id, newImageFile, value);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not upload this image.",
        );
        setErrorField("image");
        imageInputRef.current?.focus();
        setSaving(false);
        return;
      }
    }
    const record =
      kind === "ingredients"
        ? {
            id,
            english: value,
            ...(newTelugu.trim() ? { telugu: newTelugu.trim() } : {}),
            ...(newTransliteration.trim()
              ? { teluguInEnglish: newTransliteration.trim() }
              : {}),
            ...(image ? { image } : {}),
          }
        : { id, name: value };
    const next = editingRecord
      ? records.map((item) =>
          item.id === editingRecord.id
            ? (record as Ingredient | MasterRecord)
            : item,
        )
      : [...records, record as Ingredient | MasterRecord];
    const saved = await save(
      next,
      `${editingRecord ? "Update" : "Add"} ${catalogueLabel}: ${value}`,
    );
    if (!saved) {
      nameInputRef.current?.focus();
      return;
    }
    setDraft({});
    setNewEnglish("");
    setNewTelugu("");
    setNewTransliteration("");
    setNewImage("");
    setNewImageFile(null);
    setDialogOpen(false);
  };
  const remove = async (record: Ingredient | MasterRecord) => {
    setMessage("");
    const used = recipes.some((recipe) =>
      "english" in record
        ? recipe.ingredients.some((item) => item.ingredientId === record.id)
        : recipe.categoryId === record.id || recipe.teacherId === record.id,
    );
    if (used)
      return setError(
        "This entry is used by a recipe. Update those recipes before deleting it.",
      );
    if (!window.confirm("Delete " + nameOf(record) + "?")) return;
    await save(
      records.filter((r) => r.id !== record.id),
      `Delete ${catalogueLabel}: ${nameOf(record)}`,
    );
  };
  const speak = (record: Ingredient) => {
    if (speaking === record.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setSpeaking(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(
      publicAssetUrl(ingredientPronunciationPath(record)),
    );
    audioRef.current = audio;
    setSpeaking(record.id);
    const stop = () => {
      audioRef.current = null;
      setSpeaking(null);
    };
    audio.onended = stop;
    audio.onerror = stop;
    void audio.play().catch(stop);
  };
  return (
    <main className="catalogue-page">
      <button className="editor-back" onClick={onBack}>
        <ArrowLeft size={17} /> Back
      </button>
      <div className="editor-heading">
        <div>
          <span className="kicker">OWNER CATALOGUE</span>
          <h1>Ingredients, teachers & categories</h1>
          <p>Add, edit or remove the shared choices used by recipes.</p>
        </div>
      </div>
      <div className="catalogue-tabs">
        {(["ingredients", "teachers", "categories"] as Kind[]).map((item) => (
          <button
            className={kind === item ? "active" : ""}
            key={item}
            onClick={() => {
              setKind(item);
              setError("");
              setMessage("");
              setSearch("");
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="catalogue-form">
        <input
          placeholder={"Search " + kind}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => openDialog()} disabled={saving}>
          <Plus size={15} /> Add
        </button>
      </div>
      {error && !dialogOpen && <p className="editor-error">{error}</p>}
      {message && <p className="editor-success">{message}</p>}
      <div className="catalogue-list">
        {pageRecords.map((record) => (
          <div
            className={
              "catalogue-row" +
              (!("english" in record && record.image) ? " no-image" : "")
            }
            key={record.id}
          >
            {"english" in record && record.image && (
              <img
                className="catalogue-image"
                src={publicAssetUrl(record.image)}
                alt={record.english}
              />
            )}
            <div className="catalogue-record-copy">
              <strong>{nameOf(record)}</strong>
              {"english" in record && (
                <small>
                  {[record.telugu, record.teluguInEnglish]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              )}
            </div>
            {"english" in record && record.telugu && (
              <button
                className="catalogue-speak inline-flex items-center justify-center"
                onClick={() => speak(record)}
                aria-label={`${speaking === record.id ? "Stop" : "Hear"} ${record.english} in Telugu`}
              >
                {speaking === record.id ? (
                  <Square size={15} />
                ) : (
                  <Volume2 size={15} />
                )}
              </button>
            )}
            <button
              className="inline-flex items-center justify-center"
              onClick={() => openDialog(record)}
              disabled={saving}
            >
              <Pencil size={15} /> Edit
            </button>
            <button
              className="danger-button inline-flex items-center justify-center"
              onClick={() => void remove(record)}
              disabled={saving}
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        ))}
      </div>
      {visible.length > 0 && (
        <>
          <p className="catalogue-results-summary">
            Showing {pageRecords.length}
            {pageRecords.length < visible.length
              ? ` of ${visible.length}`
              : ""}{" "}
            {visible.length === 1 ? "item" : "items"}
          </p>
          {totalPages > 1 && (
            <nav className="pagination" aria-label={`${kind} pages`}>
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                aria-label="Previous catalogue page"
              >
                <ArrowLeft size={16} /> Previous
              </button>
              <div className="pagination-pages">
                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    className={pageNumber === page ? "active" : undefined}
                    onClick={() => goToPage(pageNumber)}
                    aria-current={pageNumber === page ? "page" : undefined}
                    aria-label={`${kind} page ${pageNumber}`}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
                aria-label="Next catalogue page"
              >
                Next <ArrowRight size={16} />
              </button>
              <span className="sr-only" aria-live="polite">
                Page {page} of {totalPages}
              </span>
            </nav>
          )}
        </>
      )}
      {dialogOpen && (
        <div
          className="catalogue-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            closeOnBackdrop(event, () => setDialogOpen(false))
          }
        >
          <section className="catalogue-dialog" role="dialog" aria-modal="true">
            <h2>
              {editingRecord ? "Edit" : "Add"} {kind.slice(0, -1)}
            </h2>
            <label>
              <span>{kind === "ingredients" ? "English name" : "Name"} *</span>
              <input
                ref={nameInputRef}
                autoFocus
                value={newEnglish}
                className={errorField === "name" ? "input-error" : ""}
                onChange={(e) => {
                  setNewEnglish(e.target.value);
                  setError("");
                  setErrorField(null);
                }}
              />
              {error && errorField === "name" && (
                <small className="field-error">{error}</small>
              )}
            </label>
            {kind === "ingredients" && (
              <>
                <label>
                  <span>Telugu *</span>
                  <input
                    ref={teluguInputRef}
                    value={newTelugu}
                    required
                    aria-required="true"
                    className={errorField === "telugu" ? "input-error" : ""}
                    placeholder="Example: పచ్చి మిరపకాయ"
                    onChange={(e) => {
                      setNewTelugu(e.target.value);
                      setError("");
                      setErrorField(null);
                    }}
                  />
                  {error && errorField === "telugu" && (
                    <small className="field-error">{error}</small>
                  )}
                </label>
                <label>
                  <span>Telugu in English *</span>
                  <input
                    ref={transliterationInputRef}
                    value={newTransliteration}
                    required
                    aria-required="true"
                    className={
                      errorField === "transliteration" ? "input-error" : ""
                    }
                    placeholder="Example: Pachchi mirapakaaya"
                    onChange={(e) => {
                      setNewTransliteration(e.target.value);
                      setError("");
                      setErrorField(null);
                    }}
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
                    <ImageSourcePicker compact onFile={readImage} />
                  </div>
                  {error && errorField === "image" && (
                    <small className="field-error">{error}</small>
                  )}
                </div>
                {newImage && (
                  <img
                    className="catalogue-dialog-preview"
                    src={publicAssetUrl(newImage)}
                    alt="Ingredient preview"
                  />
                )}
              </>
            )}
            <div className="catalogue-actions">
              <button type="button" onClick={() => setDialogOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveDialog()}
                disabled={saving}
              >
                {saving && <LoaderCircle className="spin" size={15} />} {saving
                  ? "Saving…"
                  : "Save"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
