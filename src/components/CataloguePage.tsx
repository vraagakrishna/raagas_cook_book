import { useRef, useState } from "react";
import { getAllAudioUrls } from "google-tts-api/dist/getAudioUrl";
import { Save, Trash2, ArrowLeft, Plus } from "lucide-react";
import {
  categories,
  ingredients,
  teachers,
  recipes,
} from "../services/catalogue";
import {
  saveCatalogueFile,
  saveIngredientImage,
  type CatalogueFile,
} from "../services/githubRecipes";
import type { Ingredient, MasterRecord } from "../types/models";
import { publicAssetUrl } from "../routing/publicAssetUrl";
import { ImageSourcePicker } from "./ImageSourcePicker";

type Kind = CatalogueFile;
const lists = { ingredients, teachers, categories };

export function CataloguePage({ onBack }: { onBack: () => void }) {
  const [kind, setKind] = useState<Kind>("ingredients");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"name" | "image" | null>(null);
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<
    Ingredient | MasterRecord | null
  >(null);
  const [newEnglish, setNewEnglish] = useState("");
  const [newTelugu, setNewTelugu] = useState("");
  const [newTransliteration, setNewTransliteration] = useState("");
  const [newImage, setNewImage] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const records = lists[kind] as (Ingredient | MasterRecord)[];
  const visible = records.filter((record) =>
    ("english" in record ? record.english : record.name)
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const nameOf = (record: Ingredient | MasterRecord) =>
    "english" in record ? record.english : record.name;
  const readImage = (file?: File) => {
    if (!file) return;
    setNewImageFile(file);
    setNewImage(URL.createObjectURL(file));
    setError("");
    setErrorField(null);
  };
  const save = async (next: (Ingredient | MasterRecord)[]) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveCatalogueFile(kind, next);
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
    let image = newImage.trim() || undefined;
    if (kind === "ingredients" && newImageFile) {
      try {
        image = await saveIngredientImage(id, newImageFile);
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
    const saved = await save(next);
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
    await save(records.filter((r) => r.id !== record.id));
  };
  const speak = (record: Ingredient) => {
    const text = record.teluguInEnglish || record.telugu || record.english;
    if (speaking === record.id) {
      setSpeaking(null);
      return;
    }
    const audio = new Audio(
      getAllAudioUrls(text, { lang: "te", slow: false }).map(
        (item) => item.url,
      )[0],
    );
    setSpeaking(record.id);
    audio.onended = () => setSpeaking(null);
    audio.onerror = () => setSpeaking(null);
    void audio.play().catch(() => setSpeaking(null));
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
        {visible.map((record) => (
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
            {"english" in record && (
              <button className="catalogue-speak" onClick={() => speak(record)}>
                {speaking === record.id ? "Stop" : "Hear"}
              </button>
            )}
            <button onClick={() => openDialog(record)} disabled={saving}>
              <Save size={15} /> Edit
            </button>
            <button
              className="danger-button"
              onClick={() => void remove(record)}
              disabled={saving}
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        ))}
      </div>
      {dialogOpen && (
        <div className="catalogue-dialog-backdrop" role="presentation">
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
                  <span>Telugu</span>
                  <input
                    value={newTelugu}
                    onChange={(e) => setNewTelugu(e.target.value)}
                  />
                </label>
                <label>
                  <span>Telugu in English</span>
                  <input
                    value={newTransliteration}
                    onChange={(e) => setNewTransliteration(e.target.value)}
                  />
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
                Save
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
