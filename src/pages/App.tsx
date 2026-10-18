import { useEffect, useMemo, useRef, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChefHat,
  Clock3,
  Copy,
  Heart,
  Menu,
  Mic,
  MicOff,
  Minus,
  Pencil,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Users,
  Volume2,
  X,
} from "lucide-react";
import {
  categories,
  categoryName,
  ingredientById,
  recipes as initialRecipes,
  teacherName,
  teachers,
} from "../services/catalogue";
import { recipeSearchScore } from "../search/recipeSearch";
import type { Difficulty, Ingredient, Recipe } from "../types/models";
import { Brand } from "../components/Brand";
import { OwnerAccess } from "../components/OwnerAccess";
import {
  RecipeEditor,
  type RecipeEditorMode,
} from "../components/RecipeEditor";
import { RecipeArtwork } from "../components/RecipeArtwork";
import type { GitHubUser } from "../services/githubAuth";
import {
  homeUrl,
  catalogueUrl,
  newRecipeUrl,
  parseRoute,
  recipeUrl,
  type Route,
} from "../routing/routes";
import { publicAssetUrl } from "../routing/publicAssetUrl";
import { deleteRecipeFromGitHub } from "../services/githubRecipes";
import { CataloguePage } from "../components/CataloguePage";
import { ingredientPronunciationPath } from "../services/pronunciation";
import { Seo } from "../components/Seo";

const minutes = (value?: number) => {
  if (value == null) return "Not specified";
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${hours} hr${hours > 1 ? "s" : ""}${mins ? ` ${mins} min` : ""}`;
};

function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [recipeItems, setRecipeItems] = useState<Recipe[]>(initialRecipes);
  const [owner, setOwner] = useState<GitHubUser | null>(null);
  const [editor, setEditor] = useState<{
    mode: RecipeEditorMode;
    recipe?: Recipe;
  } | null>(null);
  const [favourites, setFavourites] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("raagas-favourites") ?? "[]",
      ) as string[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const initialRoute = parseRoute();
    window.history.replaceState(
      null,
      "",
      initialRoute.page === "recipe"
        ? recipeUrl(initialRoute.id)
        : initialRoute.page === "new-recipe"
          ? newRecipeUrl()
          : initialRoute.page === "catalogue"
            ? catalogueUrl()
            : homeUrl(),
    );
    const onLocationChange = () => {
      setRoute(parseRoute());
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("popstate", onLocationChange);
    return () => {
      window.removeEventListener("popstate", onLocationChange);
    };
  }, []);

  useEffect(() => {
    if (route.page === "new-recipe" && owner && !editor) {
      setEditor({ mode: "create" });
    }
  }, [route.page, owner, editor]);

  const navigateHome = () => {
    window.history.pushState(null, "", homeUrl());
    setRoute({ page: "home" });
    setEditor(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openNewRecipe = () => {
    if (!owner) return;
    window.history.pushState(null, "", newRecipeUrl());
    setRoute({ page: "new-recipe" });
    setEditor({ mode: "create" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openCatalogue = () => {
    if (!owner) return;
    window.history.pushState(null, "", catalogueUrl());
    setRoute({ page: "catalogue" });
    setEditor(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const navigateRecipe = (id: string) => {
    window.history.pushState(null, "", recipeUrl(id));
    setRoute({ page: "recipe", id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const navigateSection = (id: string) => {
    navigateHome();
    window.setTimeout(
      () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  };
  const toggleFavourite = (id: string) => {
    setFavourites((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      localStorage.setItem("raagas-favourites", JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="app-shell">
      <Seo
        page={route.page}
        recipe={
          route.page === "recipe"
            ? recipeItems.find((recipe) => recipe.id === route.id)
            : undefined
        }
      />
      <Header
        onHome={navigateHome}
        onSection={navigateSection}
        currentPage={route.page}
        canManage={Boolean(owner)}
        onCreateRecipe={openNewRecipe}
        onManageCatalogue={openCatalogue}
        onOwnerChange={(nextOwner) => {
          setOwner(nextOwner);
          if (!nextOwner) {
            setEditor(null);
          }
        }}
      />
      {route.page === "catalogue" && owner ? (
        <CataloguePage onBack={navigateHome} />
      ) : editor && owner ? (
        <RecipeEditor
          mode={editor.mode}
          source={editor.recipe}
          onCancel={navigateHome}
          onSaved={(savedRecipe) => {
            setRecipeItems((current) => {
              const existing = current.some(
                (item) => item.id === savedRecipe.id,
              );
              return existing
                ? current.map((item) =>
                    item.id === savedRecipe.id ? savedRecipe : item,
                  )
                : [...current, savedRecipe];
            });
            setEditor(null);
            navigateRecipe(savedRecipe.id);
          }}
        />
      ) : route.page === "home" ? (
        <Library
          recipeItems={recipeItems}
          onOpenRecipe={navigateRecipe}
          favourites={favourites}
          onToggleFavourite={toggleFavourite}
          canManage={Boolean(owner)}
          onCreateRecipe={openNewRecipe}
        />
      ) : route.page === "new-recipe" || route.page === "catalogue" ? (
        <main className="not-found">
          <h1>Owner access required</h1>
          <p>Sign in as the cookbook owner to add a recipe.</p>
        </main>
      ) : (
        <RecipeDetail
          recipe={recipeItems.find((recipe) => recipe.id === route.id)}
          onBack={navigateHome}
          isFavourite={favourites.includes(route.id)}
          onToggleFavourite={() => toggleFavourite(route.id)}
          canManage={Boolean(owner)}
          onEdit={(recipe) => setEditor({ mode: "edit", recipe })}
          onDuplicate={(recipe) => setEditor({ mode: "duplicate", recipe })}
          onDeleted={(id) => {
            setRecipeItems((current) =>
              current.filter((item) => item.id !== id),
            );
            navigateHome();
          }}
        />
      )}
      <Footer onHome={navigateHome} />
    </div>
  );
}

function Header({
  onHome,
  onSection,
  currentPage,
  canManage,
  onCreateRecipe,
  onManageCatalogue,
  onOwnerChange,
}: {
  onHome: () => void;
  onSection: (id: string) => void;
  currentPage: Route["page"];
  canManage: boolean;
  onCreateRecipe: () => void;
  onManageCatalogue: () => void;
  onOwnerChange: (user: GitHubUser | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <button
        className="brand"
        onClick={onHome}
        aria-label="Raaga's Cook Book home"
      >
        <Brand />
      </button>
      <nav
        className={open ? "nav-links open" : "nav-links"}
        aria-label="Main navigation"
      >
        <button
          className={currentPage === "home" ? "nav-active" : undefined}
          onClick={() => {
            onHome();
            setOpen(false);
          }}
        >
          Home
        </button>
        <button
          onClick={() => {
            onSection("collections");
            setOpen(false);
          }}
        >
          Collections
        </button>
        <button
          onClick={() => {
            onSection("recipes");
            setOpen(false);
          }}
        >
          Recipes
        </button>
      </nav>
      <div className="header-actions">
        {canManage && (
          <button
            className={
              currentPage === "new-recipe"
                ? "header-add-recipe active"
                : "header-add-recipe"
            }
            onClick={onCreateRecipe}
            aria-label="Add a new recipe"
          >
            <Plus size={16} /> <span>Add recipe</span>
          </button>
        )}
        {canManage && (
          <button
            className={
              currentPage === "catalogue"
                ? "header-catalogue-button active"
                : "header-catalogue-button"
            }
            onClick={onManageCatalogue}
          >
            Catalogue
          </button>
        )}
        <OwnerAccess onSessionChange={onOwnerChange} />
        <button
          className="menu-button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

function Library({
  recipeItems,
  onOpenRecipe,
  favourites,
  onToggleFavourite,
  canManage,
  onCreateRecipe,
}: {
  recipeItems: Recipe[];
  onOpenRecipe: (id: string) => void;
  favourites: string[];
  onToggleFavourite: (id: string) => void;
  canManage: boolean;
  onCreateRecipe: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [teacher, setTeacher] = useState("all");
  const [difficulty, setDifficulty] = useState<"all" | Difficulty>("all");
  const [duration, setDuration] = useState("all");
  const [sort, setSort] = useState("recent");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [collection, setCollection] = useState("all");
  const [page, setPage] = useState(1);
  const voiceWasListening = useRef(false);
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition({ clearTranscriptOnListen: true });

  const recipesPerPage = 20;

  const filtered = useMemo(() => {
    const normalizedQuery = query.normalize("NFC").trim().toLocaleLowerCase();
    return recipeItems
      .map((recipe) => ({
        recipe,
        searchScore: normalizedQuery
          ? recipeSearchScore(recipe, normalizedQuery)
          : 1,
      }))
      .filter(({ recipe, searchScore }) => {
        const durationMatch =
          duration === "all" ||
          (duration === "short" &&
            (recipe.totalDurationMinutes ?? Infinity) <= 45) ||
          (duration === "medium" &&
            (recipe.totalDurationMinutes ?? 0) > 45 &&
            (recipe.totalDurationMinutes ?? Infinity) <= 90) ||
          (duration === "long" && (recipe.totalDurationMinutes ?? 0) > 90) ||
          (duration === "undefined" && recipe.totalDurationMinutes == null);
        const collectionMatch =
          collection === "all" ||
          (collection === "favourites" && favourites.includes(recipe.id)) ||
          (collection === "family" && recipe.featured) ||
          (collection === "quick" &&
            (recipe.totalDurationMinutes ?? Infinity) <= 45) ||
          (collection === "amma" && recipe.teacherId === "teacher-amma") ||
          (collection === "festive" && recipe.categoryId === "cat-sweet");
        return (
          (!normalizedQuery || searchScore > 0) &&
          (category === "all" || recipe.categoryId === category) &&
          (teacher === "all" || recipe.teacherId === teacher) &&
          (difficulty === "all" || recipe.difficulty === difficulty) &&
          durationMatch &&
          collectionMatch
        );
      })
      .sort((a, b) => {
        if (normalizedQuery && b.searchScore !== a.searchScore) {
          return b.searchScore - a.searchScore;
        }
        const first = a.recipe;
        const second = b.recipe;
        if (sort === "name") return first.name.localeCompare(second.name);
        if (sort === "duration")
          return (
            (first.totalDurationMinutes ?? -1) -
            (second.totalDurationMinutes ?? -1)
          );
        return Date.parse(second.updatedAt) - Date.parse(first.updatedAt);
      })
      .map(({ recipe }) => recipe);
  }, [
    query,
    category,
    teacher,
    difficulty,
    duration,
    sort,
    collection,
    favourites,
    recipeItems,
  ]);

  const activeFilterCount = [category, teacher, difficulty, duration].filter(
    (value) => value !== "all",
  ).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / recipesPerPage));
  const visibleRecipes = filtered.slice(
    (page - 1) * recipesPerPage,
    page * recipesPerPage,
  );

  useEffect(() => {
    setPage(1);
  }, [query, category, teacher, difficulty, duration, sort, collection]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const startListening = () => {
    if (listening) {
      void SpeechRecognition.stopListening();
      setVoiceMessage("Voice search stopped.");
      return;
    }
    if (!browserSupportsSpeechRecognition) {
      setVoiceMessage("Voice search is not supported in this browser.");
      return;
    }
    if (!window.isSecureContext) {
      setVoiceMessage("Voice search requires HTTPS or localhost.");
      return;
    }
    if (!isMicrophoneAvailable) {
      setVoiceMessage(
        "Microphone access is blocked. Allow it in this site's browser settings and try again.",
      );
      return;
    }
    resetTranscript();
    setVoiceMessage("Starting voice search…");
    void SpeechRecognition.startListening({
      continuous: false,
      language: "en-IN",
    }).catch(() => {
      setVoiceMessage(
        "Voice search could not start. Check this site's microphone permission and try again.",
      );
    });
  };

  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
    window.setTimeout(
      () =>
        document
          .getElementById("recipes")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setTeacher("all");
    setDifficulty("all");
    setDuration("all");
    setCollection("all");
  };

  const updateQuery = (value: string, reveal = false) => {
    setQuery(value);
    if (reveal && value.trim()) {
      window.setTimeout(() => {
        const input = document.getElementById("library-search");
        input?.scrollIntoView({ behavior: "smooth", block: "center" });
        input?.focus({ preventScroll: true });
      }, 40);
    }
  };

  useEffect(() => {
    if (listening) {
      voiceWasListening.current = true;
      setVoiceMessage("Listening…");
      return;
    }
    if (!voiceWasListening.current) return;
    voiceWasListening.current = false;
    const spokenQuery = transcript.trim();
    if (spokenQuery) {
      updateQuery(spokenQuery, true);
      setVoiceMessage("Voice search added.");
    } else if (isMicrophoneAvailable) {
      setVoiceMessage(
        "No speech was detected. Select the microphone and try again.",
      );
    }
  }, [isMicrophoneAvailable, listening, transcript]);

  useEffect(() => {
    if (!isMicrophoneAvailable) {
      setVoiceMessage(
        "Microphone access is blocked. Allow it in this site's browser settings and try again.",
      );
    }
  }, [isMicrophoneAvailable]);

  const chooseCollection = (value: string) => {
    setCollection(value);
    window.setTimeout(
      () =>
        document
          .getElementById("recipes")
          ?.scrollIntoView({ behavior: "smooth" }),
      40,
    );
  };

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={14} /> Made with love, remembered forever
          </span>
          <h1>
            Recipes that feel
            <br />
            like <em>home.</em>
          </h1>
          <p>
            A collection of family favourites, lovingly learned and carefully
            kept — one delicious memory at a time.
          </p>
          <div className="search-wrap">
            <Search size={20} />
            <input
              value={query}
              onChange={(event) => updateQuery(event.target.value, true)}
              placeholder="Search recipes, ingredients or memories…"
              aria-label="Search recipes"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <X size={17} />
              </button>
            )}
            <button
              className={listening ? "mic listening" : "mic"}
              onClick={startListening}
              aria-label="Search by voice"
            >
              {listening ? <MicOff size={19} /> : <Mic size={19} />}
            </button>
          </div>
          {voiceMessage && (
            <p className="voice-message" role="status">
              {voiceMessage}
            </p>
          )}
          <div className="quick-links">
            <span>Popular:</span>
            {["Curry", "Breakfast", "Under 45 min"].map((label) => (
              <button
                key={label}
                onClick={() =>
                  label === "Under 45 min"
                    ? setDuration("short")
                    : setCategory(
                        categories.find((item) => item.name === label)?.id ??
                          "all",
                      )
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun-ring ring-one" />
          <div className="sun-ring ring-two" />
          <div className="leaf leaf-one">❧</div>
          <div className="leaf leaf-two">❧</div>
          <div className="hero-bowl">
            <span>🥘</span>
          </div>
          <span className="spice spice-one">✦</span>
          <span className="spice spice-two">✦</span>
          <span className="spice spice-three">•</span>
        </div>
      </section>

      <section className="collections-section" id="collections">
        <div>
          <span className="kicker">COOK WITH A MOOD</span>
          <h2>Collections</h2>
          <p>A quicker way into the recipe box.</p>
        </div>
        <div className="collection-grid">
          {[
            [
              "family",
              "✦",
              "Family favourites",
              "The recipes everyone asks for",
            ],
            ["quick", "◷", "Quick & comforting", "On the table in 45 minutes"],
            ["amma", "♡", "Amma’s kitchen", "Recipes learned at her side"],
            ["festive", "❉", "Festive sweets", "A little celebration"],
            [
              "favourites",
              "♥",
              "My favourites",
              `${favourites.length} saved on this device`,
            ],
          ].map(([id, icon, title, copy]) => (
            <button
              className={
                collection === id ? "collection-card active" : "collection-card"
              }
              key={id}
              onClick={() => chooseCollection(id)}
            >
              <span>{icon}</span>
              <strong>{title}</strong>
              <small>{copy}</small>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </section>

      <section className="library-section" id="recipes">
        <div className="section-heading">
          <div>
            <span className="kicker">FROM THE KITCHEN</span>
            <h2>Explore the recipe box</h2>
            <p>
              {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}{" "}
              waiting to be cooked
            </p>
          </div>
          <div className="toolbar">
            {canManage && (
              <button className="owner-create-button" onClick={onCreateRecipe}>
                <Plus size={17} /> Add recipe
              </button>
            )}
            <button
              className={
                filtersOpen || activeFilterCount
                  ? "filter-button active"
                  : "filter-button"
              }
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal size={17} /> Filters{" "}
              {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
            </button>
            <label className="select-control">
              <span>Sort:</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recent">Recently updated</option>
                <option value="name">Name A–Z</option>
                <option value="duration">Shortest first</option>
              </select>
              <ChevronDown size={15} />
            </label>
          </div>
        </div>
        <div className="filter-search">
          <Search size={19} />
          <input
            id="library-search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search recipes, ingredients or Telugu-in-English…"
            aria-label="Search and filter recipes"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search">
              <X size={17} />
            </button>
          )}
        </div>
        {filtersOpen && (
          <div className="filter-panel">
            <Filter
              label="Category"
              value={category}
              setValue={setCategory}
              options={categories.map((item) => [item.id, item.name])}
            />
            <Filter
              label="Taught by"
              value={teacher}
              setValue={setTeacher}
              options={teachers.map((item) => [item.id, item.name])}
            />
            <Filter
              label="Difficulty"
              value={difficulty}
              setValue={(value) => setDifficulty(value as "all" | Difficulty)}
              options={["easy", "medium", "hard"].map((item) => [
                item,
                item[0].toUpperCase() + item.slice(1),
              ])}
            />
            <Filter
              label="Total time"
              value={duration}
              setValue={setDuration}
              options={[
                ["short", "45 min or less"],
                ["medium", "46–90 min"],
                ["long", "Over 90 min"],
                ["undefined", "Not specified"],
              ]}
            />
            {activeFilterCount > 0 && (
              <button className="clear-filter" onClick={clearFilters}>
                Clear all
              </button>
            )}
          </div>
        )}
        {(query || activeFilterCount > 0) && (
          <div className="results-summary">
            <span>
              Showing {visibleRecipes.length}
              {visibleRecipes.length < filtered.length
                ? ` of ${filtered.length}`
                : ""}{" "}
              result{filtered.length !== 1 ? "s" : ""}
              {query ? (
                <>
                  {" "}
                  for “<strong>{query}</strong>”
                </>
              ) : (
                ""
              )}
            </span>
            <button onClick={clearFilters}>Reset search & filters</button>
          </div>
        )}
        {filtered.length > 0 ? (
          <>
            <div className="recipe-grid">
              {visibleRecipes.map((recipe, index) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  index={(page - 1) * recipesPerPage + index}
                  onOpen={() => onOpenRecipe(recipe.id)}
                  saved={favourites.includes(recipe.id)}
                  onToggleFavourite={() => onToggleFavourite(recipe.id)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <nav className="pagination" aria-label="Recipe pages">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  aria-label="Previous recipe page"
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
                      aria-label={`Recipe page ${pageNumber}`}
                    >
                      {pageNumber}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  aria-label="Next recipe page"
                >
                  Next <ArrowRight size={16} />
                </button>
                <span className="sr-only" aria-live="polite">
                  Page {page} of {totalPages}
                </span>
              </nav>
            )}
          </>
        ) : (
          <div className="empty-state">
            <span>🥄</span>
            <h3>No recipe in this corner yet</h3>
            <p>Try a different ingredient, teacher or category.</p>
            <button onClick={clearFilters}>See all recipes</button>
          </div>
        )}
      </section>

      <section className="story-band" id="story">
        <span className="story-flourish">❦</span>
        <p className="kicker">WHY THIS BOOK EXISTS</p>
        <blockquote>
          “The best recipes aren’t written in ink.
          <br />
          They’re passed from <em>hand to hand.</em>”
        </blockquote>
        <p>
          Every dish here carries a voice, a kitchen, and someone worth
          remembering.
        </p>
      </section>
    </main>
  );
}

function Filter({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: string[][];
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="all">All</option>
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function RecipeCard({
  recipe,
  index,
  onOpen,
  saved,
  onToggleFavourite,
}: {
  recipe: Recipe;
  index: number;
  onOpen: () => void;
  saved: boolean;
  onToggleFavourite: () => void;
}) {
  return (
    <article
      className="recipe-card"
      style={{ "--delay": `${index * 55}ms` } as React.CSSProperties}
    >
      <button
        className={
          recipe.coverImage
            ? `card-image cover-${recipe.categoryId.replace("cat-", "")}`
            : "card-image no-cover"
        }
        onClick={onOpen}
        aria-label={`Open ${recipe.name}`}
      >
        <RecipeArtwork recipe={recipe} />
        <span className="plate-ring" />
        {recipe.featured && (
          <span className="featured-label">
            <Sparkles size={12} /> Family favourite
          </span>
        )}
      </button>
      <button
        className={saved ? "heart saved" : "heart"}
        onClick={onToggleFavourite}
        aria-label={saved ? "Remove from favourites" : "Add to favourites"}
      >
        <Heart size={19} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="card-body">
        <div className="card-category">{categoryName(recipe.categoryId)}</div>
        <button className="card-title" onClick={onOpen}>
          <h3>{recipe.name}</h3>
        </button>
        {recipe.nickname && <p className="nickname">“{recipe.nickname}”</p>}
        <p className="teacher-line">
          Taught by <strong>{teacherName(recipe.teacherId)}</strong>
        </p>
        <div className="card-meta">
          <span>
            <Clock3 size={15} /> {minutes(recipe.totalDurationMinutes)}
          </span>
          <span>
            <Users size={15} /> Serves {recipe.servings}
          </span>
          <span className={`difficulty ${recipe.difficulty}`}>
            {recipe.difficulty}
          </span>
        </div>
      </div>
    </article>
  );
}

function RecipeDetail({
  recipe,
  onBack,
  isFavourite,
  onToggleFavourite,
  canManage,
  onEdit,
  onDuplicate,
  onDeleted,
}: {
  recipe?: Recipe;
  onBack: () => void;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  canManage: boolean;
  onEdit: (recipe: Recipe) => void;
  onDuplicate: (recipe: Recipe) => void;
  onDeleted: (id: string) => void;
}) {
  const [servings, setServings] = useState(recipe?.servings ?? 1);
  const [checkedIngredients, setCheckedIngredients] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackIdRef = useRef(0);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [audioError, setAudioError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return () => {
      playbackIdRef.current += 1;
      audioRef.current?.pause();
    };
  }, []);
  if (!recipe)
    return (
      <main className="not-found">
        <span>🍽️</span>
        <h1>Recipe not found</h1>
        <p>This recipe may have moved, but the kitchen is still open.</p>
        <button onClick={onBack}>
          <ArrowLeft size={17} /> Back to all recipes
        </button>
      </main>
    );

  const playPronunciation = (
    teluguText: string,
    audioPaths?: string | string[],
  ) => {
    playbackIdRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    setAudioError("");
    if (speakingText === teluguText) {
      setSpeakingText(null);
      return;
    }
    const paths = Array.isArray(audioPaths)
      ? audioPaths
      : audioPaths
        ? [audioPaths]
        : [];
    const urls = paths.map((path) => publicAssetUrl(path));
    if (urls.length === 0) {
      setAudioError(
        "Pronunciation audio is not included in this deployment yet.",
      );
      return;
    }
    const playbackId = playbackIdRef.current;
    setSpeakingText(teluguText);

    const playNext = (index: number) => {
      if (playbackId !== playbackIdRef.current) return;
      if (index >= urls.length) {
        audioRef.current = null;
        setSpeakingText(null);
        return;
      }
      const audio = new Audio(urls[index]);
      audioRef.current = audio;
      audio.onended = () => playNext(index + 1);
      audio.onerror = () => {
        audioRef.current = null;
        setSpeakingText(null);
        setAudioError(
          "This pronunciation audio is missing from the deployed site. Run the GitHub Pages workflow again.",
        );
      };
      void audio.play().catch(() => audio.onerror?.(new Event("error")));
    };

    playNext(0);
  };

  const share = async () => {
    const payload = {
      title: recipe.name,
      text: recipe.note ?? recipe.name,
      url: window.location.href,
    };
    if (navigator.share) await navigator.share(payload).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(window.location.href);
      alert("Recipe link copied!");
    }
  };

  return (
    <main className="detail-page">
      <div className="detail-topbar">
        <button onClick={onBack}>
          <ArrowLeft size={17} /> Back to recipes
        </button>
        <div>
          {canManage && (
            <>
              <button
                className="owner-detail-action"
                onClick={() => onEdit(recipe)}
              >
                <Pencil size={16} /> Edit
              </button>
              <button
                className="owner-detail-action"
                onClick={() => onDuplicate(recipe)}
              >
                <Copy size={16} /> Duplicate
              </button>
              <button
                className="owner-detail-action danger"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 size={16} /> Delete
              </button>
            </>
          )}
          <button
            className={
              isFavourite ? "detail-favourite saved" : "detail-favourite"
            }
            onClick={onToggleFavourite}
          >
            <Heart size={16} fill={isFavourite ? "currentColor" : "none"} />{" "}
            {isFavourite ? "Saved" : "Favourite"}
          </button>
          <button onClick={share}>
            <Share2 size={16} /> Share recipe
          </button>
        </div>
      </div>
      {deleteOpen && (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete {recipe.name}?</h2>
            <p>
              This removes the recipe JSON and any images for it from GitHub.
            </p>
            <label>
              <span>Type the recipe name to confirm</span>
              <input
                autoFocus
                value={deleteName}
                onChange={(event) => setDeleteName(event.target.value)}
              />
            </label>
            {deleteError && <p className="editor-error">{deleteError}</p>}
            <div className="catalogue-actions">
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteName("");
                  setDeleteError("");
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={deleting || deleteName !== recipe.name}
                onClick={() => {
                  setDeleting(true);
                  void deleteRecipeFromGitHub(recipe)
                    .then(() => onDeleted(recipe.id))
                    .catch((error) => {
                      setDeleteError(
                        error instanceof Error
                          ? error.message
                          : "Could not delete this recipe.",
                      );
                      setDeleting(false);
                    });
                }}
              >
                {deleting ? "Deleting…" : "Delete recipe"}
              </button>
            </div>
          </div>
        </div>
      )}
      <section className="detail-hero">
        <div
          className={
            recipe.coverImage
              ? `detail-art cover-${recipe.categoryId.replace("cat-", "")}`
              : "detail-art no-cover"
          }
        >
          <RecipeArtwork recipe={recipe} />
          <div className="detail-ring" />
        </div>
        <div className="detail-intro">
          <span className="kicker">
            {categoryName(recipe.categoryId)} · TAUGHT BY{" "}
            {teacherName(recipe.teacherId).toUpperCase()}
          </span>
          <h1>{recipe.name}</h1>
          {recipe.nickname && (
            <p className="detail-nickname">“{recipe.nickname}”</p>
          )}
          <div className="detail-meta">
            <span>
              <Clock3 /> <small>Total time</small>
              <strong>{minutes(recipe.totalDurationMinutes)}</strong>
            </span>
            <span>
              <Users /> <small>Serves</small>
              <strong>{recipe.servings}</strong>
            </span>
            <span>
              <ChefHat /> <small>Difficulty</small>
              <strong>{recipe.difficulty}</strong>
            </span>
          </div>
        </div>
      </section>

      <section className="recipe-content">
        <aside className="ingredients-panel">
          <div className="content-title">
            <div>
              <span className="section-number">01</span>
              <h2>Ingredients</h2>
            </div>
            {recipe.ingredients.some(
              (item) => ingredientById(item.ingredientId)?.telugu,
            ) && (
              <div className="pronunciation-controls">
                <button
                  onClick={() =>
                    playPronunciation(
                      recipe.ingredients
                        .map(
                          (item) => ingredientById(item.ingredientId)?.telugu,
                        )
                        .filter(Boolean)
                        .join(", "),
                      recipe.ingredients
                        .map((item) => ingredientById(item.ingredientId))
                        .filter((item): item is Ingredient =>
                          Boolean(item?.telugu),
                        )
                        .map(ingredientPronunciationPath),
                    )
                  }
                >
                  {speakingText ? <Square size={13} /> : <Volume2 size={15} />}
                  {speakingText ? "Stop" : "Hear Telugu"}
                </button>
              </div>
            )}
          </div>
          {audioError && (
            <p className="audio-error" role="alert">
              {audioError}
            </p>
          )}
          <div className="serving-adjust">
            <span>Adjust servings</span>
            <div>
              <button
                onClick={() => setServings(Math.max(1, servings - 1))}
                aria-label="Decrease servings"
              >
                <Minus size={14} />
              </button>
              <strong>{servings}</strong>
              <button
                onClick={() => setServings(servings + 1)}
                aria-label="Increase servings"
              >
                +
              </button>
            </div>
          </div>
          <ul className="ingredient-list">
            {recipe.ingredients.map((entry) => {
              const ingredient = ingredientById(entry.ingredientId);
              const ratio = servings / recipe.servings;
              return (
                <li
                  key={entry.ingredientId}
                  className={
                    checkedIngredients.includes(entry.ingredientId)
                      ? "checked"
                      : ""
                  }
                >
                  <button
                    className="ingredient-check"
                    onClick={() =>
                      setCheckedIngredients((current) =>
                        current.includes(entry.ingredientId)
                          ? current.filter((id) => id !== entry.ingredientId)
                          : [...current, entry.ingredientId],
                      )
                    }
                    aria-pressed={checkedIngredients.includes(
                      entry.ingredientId,
                    )}
                    aria-label={`${checkedIngredients.includes(entry.ingredientId) ? "Uncheck" : "Check"} ${ingredient?.english}`}
                  >
                    <Check size={13} />
                  </button>
                  <div>
                    {ingredient?.image && (
                      <img
                        className="ingredient-image"
                        src={publicAssetUrl(ingredient.image)}
                        alt=""
                      />
                    )}
                    <strong>{ingredient?.english}</strong>
                    {ingredient?.telugu && (
                      <span className="telugu">
                        <span>{ingredient.telugu}</span>
                        {ingredient.teluguInEnglish && (
                          <em>{ingredient.teluguInEnglish}</em>
                        )}
                        <button
                          onClick={() =>
                            playPronunciation(
                              ingredient.telugu!,
                              ingredientPronunciationPath(ingredient),
                            )
                          }
                          aria-label={`Hear the Telugu pronunciation of ${ingredient.english}`}
                        >
                          {speakingText === ingredient.telugu ? (
                            <Square size={12} />
                          ) : (
                            <Volume2 size={14} />
                          )}
                        </button>
                      </span>
                    )}
                    {entry.note && <small>{entry.note}</small>}
                  </div>
                  <b>
                    {ratio === 1
                      ? entry.quantity
                      : `${entry.quantity} × ${ratio.toFixed(1)}`}
                  </b>
                </li>
              );
            })}
          </ul>
          {servings !== recipe.servings && (
            <p className="scaling-note">
              Quantities are shown as a multiplier because some human-readable
              amounts can’t be scaled safely.
            </p>
          )}
        </aside>
        <article className="method-panel">
          <div className="content-title">
            <div>
              <span className="section-number">02</span>
              <h2>Method</h2>
            </div>
          </div>
          <ol className="steps-list">
            {recipe.steps.map((step, index) => (
              <li key={step.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>{step.instruction}</p>
                  {step.image && (
                    <img
                      className="step-image"
                      src={publicAssetUrl(step.image)}
                      alt={`Step ${index + 1}`}
                    />
                  )}
                  {index === 0 && recipe.prepDurationMinutes && (
                    <small>
                      <Clock3 size={13} /> About{" "}
                      {minutes(recipe.prepDurationMinutes)}
                    </small>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="cook-note">
            <span>✦</span>
            <div>
              <strong>Raaga’s note</strong>
              <p>
                {recipe.note ?? "Taste as you go. Your senses finish the dish."}
              </p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function Footer({ onHome }: { onHome: () => void }) {
  return (
    <footer>
      <button className="footer-brand" onClick={onHome}>
        <Brand />
      </button>
      <p>Made with love & a little extra spice.</p>
      <a href="#recipes">
        Back to top <ArrowRight size={14} />
      </a>
    </footer>
  );
}

export default App;
