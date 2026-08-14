(function () {
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const suggestionsEl = document.getElementById("suggestions");
  const recipeBrowserEl = document.getElementById("recipe-browser");
  const browserHeadingEl = document.getElementById("browser-heading");
  const recipeGridEl = document.getElementById("recipe-grid");
  const toggleAllBtn = document.getElementById("toggle-all");
  const resultEl = document.getElementById("result");
  const notFoundEl = document.getElementById("not-found");
  const notFoundMsgEl = document.getElementById("not-found-msg");
  const notFoundHintEl = document.getElementById("not-found-hint");
  const lookupEl = document.getElementById("looking-up");
  const lookupNameEl = document.getElementById("lookup-name");
  const sourcesBlockEl = document.getElementById("sources-block");
  const sourceListEl = document.getElementById("source-list");
  const backBtn = document.getElementById("back-btn");

  const recipeNameEl = document.getElementById("recipe-name");
  const recipeTimeEl = document.getElementById("recipe-time");
  const recipeServingsEl = document.getElementById("recipe-servings");
  const ingredientListEl = document.getElementById("ingredient-list");
  const allStepsEl = document.getElementById("all-steps");
  const currentStepEl = document.getElementById("current-step");
  const stepCounterEl = document.getElementById("step-counter");
  const stepProgressBarEl = document.getElementById("step-progress-bar");
  const prevStepBtn = document.getElementById("prev-step");
  const nextStepBtn = document.getElementById("next-step");

  const HOME_PICK_COUNT = 5;

  let currentRecipe = null;
  let currentStepIndex = 0;
  let showingAllRecipes = false;

  function normalize(str) {
    return str.trim().toLowerCase();
  }

  function matchScore(query, recipe) {
    const q = normalize(query);
    if (!q) return -1;
    const names = [recipe.name, ...(recipe.aliases || [])].map(normalize);
    for (const n of names) {
      if (n === q) return 100;
    }
    for (const n of names) {
      if (n.includes(q) || q.includes(n)) return 80;
    }
    return -1;
  }

  function searchRecipes(query) {
    return RECIPES.map((r) => ({ recipe: r, score: matchScore(query, r) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.recipe);
  }

  function renderRecipeGrid() {
    const shown = showingAllRecipes
      ? RECIPES
      : RECIPES.slice(0, HOME_PICK_COUNT);

    browserHeadingEl.textContent = showingAllRecipes ? "全部食譜" : "推薦菜色";
    toggleAllBtn.textContent = showingAllRecipes
      ? "收起來"
      : `看全部 ${RECIPES.length} 道 →`;
    toggleAllBtn.classList.toggle("hidden", RECIPES.length <= HOME_PICK_COUNT);

    recipeGridEl.innerHTML = "";
    shown.forEach((r) => {
      const card = document.createElement("button");
      card.className = "recipe-card";

      const name = document.createElement("span");
      name.className = "card-name";
      name.textContent = r.name;

      const meta = document.createElement("span");
      meta.className = "card-meta";
      meta.textContent = `⏱ ${r.time} ・ 🍽 ${r.servings}`;

      card.appendChild(name);
      card.appendChild(meta);
      card.addEventListener("click", () => {
        searchInput.value = r.name;
        showRecipe(r);
      });
      recipeGridEl.appendChild(card);
    });
  }

  function renderSuggestions(query) {
    const matches = searchRecipes(query).slice(0, 8);
    suggestionsEl.innerHTML = "";
    if (!query || matches.length === 0) {
      suggestionsEl.classList.add("hidden");
      return;
    }
    matches.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r.name;
      li.addEventListener("click", () => {
        searchInput.value = r.name;
        suggestionsEl.classList.add("hidden");
        showRecipe(r);
      });
      suggestionsEl.appendChild(li);
    });
    suggestionsEl.classList.remove("hidden");
  }

  function showRecipe(recipe) {
    currentRecipe = recipe;
    currentStepIndex = 0;

    notFoundEl.classList.add("hidden");
    recipeBrowserEl.classList.add("hidden");
    lookupEl.classList.add("hidden");
    resultEl.classList.remove("hidden");
    suggestionsEl.classList.add("hidden");

    recipeNameEl.textContent = recipe.name;
    recipeTimeEl.textContent = "⏱ " + recipe.time;
    recipeServingsEl.textContent = "🍽 " + recipe.servings;

    ingredientListEl.innerHTML = "";
    recipe.ingredients.forEach((ing, i) => {
      const li = document.createElement("li");
      li.id = "ing-" + i;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", () => {
        li.classList.toggle("checked", checkbox.checked);
      });

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = ing.name;

      const qty = document.createElement("span");
      qty.className = "qty";
      qty.textContent = ing.qty || "";

      li.appendChild(checkbox);
      li.appendChild(name);
      li.appendChild(qty);
      ingredientListEl.appendChild(li);
    });

    renderSources(recipe.sources);
    renderSteps();
  }

  function renderSources(sources) {
    sourceListEl.innerHTML = "";
    const list = Array.isArray(sources) ? sources.filter(Boolean) : [];
    sourcesBlockEl.classList.toggle("hidden", list.length === 0);
    list.forEach((url) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = url;
      a.textContent = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      li.appendChild(a);
      sourceListEl.appendChild(li);
    });
  }

  function renderSteps() {
    const steps = currentRecipe.steps;

    allStepsEl.innerHTML = "";
    steps.forEach((s, i) => {
      const li = document.createElement("li");
      li.textContent = s;
      if (i === currentStepIndex) li.classList.add("current");
      allStepsEl.appendChild(li);
    });

    currentStepEl.textContent =
      steps.length > 0 ? steps[currentStepIndex] : "沒有步驟資料";
    stepCounterEl.textContent = `第 ${currentStepIndex + 1} / ${steps.length} 步`;
    stepProgressBarEl.style.width =
      ((currentStepIndex + 1) / steps.length) * 100 + "%";

    prevStepBtn.disabled = currentStepIndex === 0;
    nextStepBtn.disabled = currentStepIndex === steps.length - 1;
  }

  function showNotFound(message, hint) {
    resultEl.classList.add("hidden");
    recipeBrowserEl.classList.remove("hidden");
    notFoundEl.classList.remove("hidden");
    suggestionsEl.classList.add("hidden");
    notFoundMsgEl.textContent = message || "這道菜正在補充中，很快就會加進來 🍳";
    notFoundHintEl.textContent =
      hint || "先看看下面其他菜色，或告訴我們你想吃什麼";
  }

  function showLookingUp(name) {
    resultEl.classList.add("hidden");
    notFoundEl.classList.add("hidden");
    recipeBrowserEl.classList.add("hidden");
    suggestionsEl.classList.add("hidden");
    lookupNameEl.textContent = name;
    lookupEl.classList.remove("hidden");
  }

  function hideLookingUp() {
    lookupEl.classList.add("hidden");
  }

  // 資料庫裡沒有的菜，交給後端上網查（沒有後端時安靜地退回「補充中」訊息）
  async function lookUpOnline(name) {
    showLookingUp(name);
    try {
      const res = await fetch(
        "/api/recipe?name=" + encodeURIComponent(name)
      );
      const data = await res.json();
      hideLookingUp();

      if (data.status === "found" && data.recipe) {
        RECIPES.push(data.recipe);
        renderRecipeGrid();
        showRecipe(data.recipe);
        return;
      }
      if (data.status === "not_a_dish") {
        showNotFound(data.message, "請確認菜名是否正確，或換一道菜試試");
        return;
      }
      showNotFound();
    } catch {
      // 純靜態部署（沒有後端）會走到這裡
      hideLookingUp();
      showNotFound();
    }
  }

  function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    const matches = searchRecipes(query);
    if (matches.length > 0) {
      showRecipe(matches[0]);
    } else {
      lookUpOnline(query);
    }
  }

  searchInput.addEventListener("input", () => {
    renderSuggestions(searchInput.value);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  });

  searchInput.addEventListener("focus", () => {
    if (searchInput.value) renderSuggestions(searchInput.value);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-section")) {
      suggestionsEl.classList.add("hidden");
    }
  });

  searchBtn.addEventListener("click", handleSearch);

  toggleAllBtn.addEventListener("click", () => {
    showingAllRecipes = !showingAllRecipes;
    renderRecipeGrid();
  });

  backBtn.addEventListener("click", () => {
    resultEl.classList.add("hidden");
    notFoundEl.classList.add("hidden");
    recipeBrowserEl.classList.remove("hidden");
    searchInput.value = "";
    searchInput.focus();
  });

  prevStepBtn.addEventListener("click", () => {
    if (currentStepIndex > 0) {
      currentStepIndex--;
      renderSteps();
    }
  });

  nextStepBtn.addEventListener("click", () => {
    if (currentStepIndex < currentRecipe.steps.length - 1) {
      currentStepIndex++;
      renderSteps();
    }
  });

  renderRecipeGrid();
})();
