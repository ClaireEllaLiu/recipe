(function () {
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const suggestionsEl = document.getElementById("suggestions");
  const quickListEl = document.getElementById("quick-list");
  const resultEl = document.getElementById("result");
  const notFoundEl = document.getElementById("not-found");
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
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  let currentRecipe = null;
  let currentStepIndex = 0;

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

  function renderQuickList() {
    quickListEl.innerHTML = "";
    const picks = RECIPES.slice(0, 8);
    picks.forEach((r) => {
      const chip = document.createElement("button");
      chip.className = "quick-chip";
      chip.textContent = r.name;
      chip.addEventListener("click", () => {
        searchInput.value = r.name;
        showRecipe(r);
      });
      quickListEl.appendChild(chip);
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

    renderSteps();
    switchTab("ingredients");
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

  function switchTab(tabName) {
    tabBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    tabPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === "tab-" + tabName);
    });
  }

  function showNotFound() {
    resultEl.classList.add("hidden");
    notFoundEl.classList.remove("hidden");
    suggestionsEl.classList.add("hidden");
  }

  function handleSearch() {
    const query = searchInput.value;
    if (!query.trim()) return;
    const matches = searchRecipes(query);
    if (matches.length > 0) {
      showRecipe(matches[0]);
    } else {
      showNotFound();
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

  backBtn.addEventListener("click", () => {
    resultEl.classList.add("hidden");
    notFoundEl.classList.add("hidden");
    searchInput.value = "";
    searchInput.focus();
  });

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
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

  renderQuickList();
})();
