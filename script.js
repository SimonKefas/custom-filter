/* ====================================================================
   CUSTOM FILTER  ·  v1.1.3  (2025-05-25)
   --------------------------------------------------------------------
   + NEW: Exact-match support — opt-in with data-exact-match="true".
          If at least one element in a category carries the attribute
          (either `[custom-filter-auto]` or `[custom-filter-field]`),
          that entire category switches from partial “contains” matching
          to strict equality.
   ==================================================================== */

/* ───────────── GLOBAL REFERENCES ─────────────────────────────────── */
let filterContainer;
let listContainer;
let itemData        = [];
let exactMatchCats  = new Set();   // ← categories requiring exact match

/* ───────────── INITIALISATION ────────────────────────────────────── */
/**
 * Call this *after* your items are in the DOM
 * (e.g. after Wized data load or CMS render).
 */
function initializeFilters() {
  console.log('[DEBUG] initializeFilters() called.');

  // 0) Containers
  filterContainer = document.querySelector('[custom-filter="filters"]');
  listContainer   = document.querySelector('[custom-filter="list"]');
  if (!filterContainer || !listContainer) {
    console.warn('[DEBUG] Missing filter container or list container.');
    return;
  }

  // 1) Collect item data
  itemData = collectItemData(listContainer);
  console.log('[DEBUG] itemData:', itemData);

  // 1-b) Detect exact-match categories
  collectExactMatchCategories();
  console.log('[DEBUG] exactMatchCats:', [...exactMatchCats]);

  // 2) Auto-populate filters
  setupAutoPopulatedFilters();

  // 3) Range sliders
  setupRangeSliders();

  // 4) Live / submit listeners
  const formHasSubmit = filterContainer.querySelector('[custom-filter-submit="true"]');
  if (formHasSubmit) {
    filterContainer.addEventListener('submit', e => {
      e.preventDefault();
      applyFilters();
    });
  } else {
    filterContainer.addEventListener('input',  () => applyFilters());
    filterContainer.addEventListener('change', () => applyFilters());
  }

  // 5) Clear buttons
  filterContainer.querySelectorAll('[custom-filter-clear="all"]').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('[DEBUG] "Clear All" button clicked');
      resetAllFilters();
      applyFilters();
    });
  });
  filterContainer.querySelectorAll('[custom-filter-clear]:not([custom-filter-clear="all"])').forEach(btn => {
    const cat = btn.getAttribute('custom-filter-clear');
    btn.addEventListener('click', () => {
      console.log(`[DEBUG] Clearing category: ${cat}`);
      clearCategoryFilter(cat);
      applyFilters();
    });
  });

  // 6) Sorting select (may live outside filterContainer)
  const sortSelect = document.querySelector('[custom-filter-sort="true"]');
  if (sortSelect) sortSelect.addEventListener('change', () => applyFilters());

  // 7) Initial run
  applyFilters();
}

/* ───────────── DATA COLLECTION HELPERS ───────────────────────────── */
/** Scan DOM for elements with data-exact-match="true" */
function collectExactMatchCategories() {
  exactMatchCats.clear();

  // A) auto-generated filter blocks
  filterContainer.querySelectorAll('[custom-filter-auto][data-exact-match="true"]')
    .forEach(el => exactMatchCats.add(el.getAttribute('custom-filter-auto')));

  // B) individual inputs / spans
  filterContainer.querySelectorAll('[custom-filter-field][data-exact-match="true"]')
    .forEach(el => {
      el.getAttribute('custom-filter-field')
        .split(',')
        .map(str => str.trim())
        .forEach(cat => exactMatchCats.add(cat));
    });
}

/**
 * Collect item data from [custom-filter-item],
 * reading text from any [custom-filter-field="category"].
 */
function collectItemData(container) {
  const items = [...container.querySelectorAll('[custom-filter-item]')];
  return items.map(item => {
    const fields = {};
    item.querySelectorAll('[custom-filter-field]').forEach(el => {
      el.getAttribute('custom-filter-field')
        .split(',')
        .map(c => c.trim())
        .forEach(cat => {
          fields[cat] = fields[cat] || [];
          fields[cat].push(el.textContent.toLowerCase().trim());
        });
    });
    return { element: item, fields };
  });
}

/* ───────────── AUTO-POPULATE FILTERS ─────────────────────────────── */
function setupAutoPopulatedFilters() {
  const autoFilters = filterContainer.querySelectorAll('[custom-filter-auto]');
  autoFilters.forEach(autoEl => {
    const category    = autoEl.getAttribute('custom-filter-auto');
    const autoType    = autoEl.getAttribute('data-auto-type') || 'select';
    const useTemplate = autoEl.hasAttribute('data-auto-template');

    // unique values
    const uniqueVals = new Set();
    itemData.forEach(item => {
      if (item.fields[category]) item.fields[category].forEach(val => uniqueVals.add(val));
    });
    const sortedVals = [...uniqueVals].sort();

    if (sortedVals.length === 0) {
      console.log(`[DEBUG] No values for category "${category}". Skipping auto-population.`);
      return;
    }

    if (useTemplate) {
      autoPopulateWithTemplate(autoEl, category, autoType, sortedVals);
    } else {
      autoPopulateSimple(autoEl, category, autoType, sortedVals);
    }
  });
}

/* ---- Simple auto-populate (select / checkboxes / radios) ---------- */
function autoPopulateSimple(autoEl, category, autoType, sortedValues) {
  if (autoType === 'select') {
    if (autoEl.tagName.toLowerCase() === 'select') {
      autoEl.innerHTML = '';
      const placeholderText = autoEl.getAttribute('data-placeholder') || `Choose ${capitalize(category)}`;
      const def = document.createElement('option');
      def.value = '';
      def.textContent = placeholderText;
      def.disabled = true;
      def.selected = true;
      autoEl.appendChild(def);

      sortedValues.forEach(val => {
        if (!val.trim()) return;
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = capitalize(val);
        autoEl.appendChild(opt);
      });

      if (!autoEl.hasAttribute('custom-filter-field')) {
        autoEl.setAttribute('custom-filter-field', category);
      }
    } else {
      console.warn(`[DEBUG] data-auto-type="select" but element is not <select>. Category: ${category}`);
    }
  }

  else if (autoType === 'checkbox' || autoType === 'radio') {
    autoEl.innerHTML = '';
    sortedValues.forEach((val, idx) => {
      if (!val.trim()) return;

      const label = document.createElement('label');
      label.style.display = 'block';

      const wfCheckboxDiv = document.createElement('div');
      wfCheckboxDiv.classList.add('w-checkbox-input', 'w-checkbox-input--inputType-custom');

      const input = document.createElement('input');
      input.type = autoType;
      const id = `checkbox-${category}-${idx}`;
      input.id = id;
      input.value = val;
      input.style.opacity = '0';
      input.style.position = 'absolute';
      input.style.zIndex   = '-1';

      const span = document.createElement('span');
      span.setAttribute('custom-filter-field', category);
      span.textContent = capitalize(val);

      label.appendChild(wfCheckboxDiv);
      label.appendChild(input);
      label.appendChild(span);
      autoEl.appendChild(label);
    });
  }
}

/* ---- Template-based auto-populate -------------------------------- */
function autoPopulateWithTemplate(autoEl, category, autoType, sortedValues) {
  const templateItem = autoEl.querySelector('[data-auto-template-item]');
  if (!templateItem) {
    console.warn(`[DEBUG] No [data-auto-template-item] found for category "${category}".`);
    return;
  }

  // remove existing clones
  [...autoEl.children].filter(ch => ch !== templateItem).forEach(ch => ch.remove());

  sortedValues.forEach((val, idx) => {
    if (!val.trim()) return;

    const clone = templateItem.cloneNode(true);
    clone.style.display = 'block';

    const wfCheckboxDiv = clone.querySelector('.w-checkbox-input');
    if (wfCheckboxDiv) wfCheckboxDiv.classList.remove('w--redirected-checked');

    const input = clone.querySelector('input[type="checkbox"], input[type="radio"]');
    if (input) {
      input.type = autoType;
      input.id   = `checkbox-${category}-${idx}`;
      input.value = val;
      input.checked = false;
    }

    const span = clone.querySelector(`[custom-filter-field="${category}"]`) ||
                 clone.querySelector('[custom-filter-field]');
    if (span) span.textContent = capitalize(val);

    autoEl.appendChild(clone);
  });

  templateItem.style.display = 'none';
}

/* ───────────── RANGE SLIDERS (noUiSlider) ───────────────────────── */
function setupRangeSliders() {
  if (!window.noUiSlider) {
    console.warn('[DEBUG] noUiSlider not found, skipping slider creation.');
    return;
  }

  filterContainer.querySelectorAll('.my-range-slider').forEach(sliderEl => {
    const category      = sliderEl.getAttribute('data-slider-category') || 'undefined';
    const mode          = sliderEl.getAttribute('data-slider-mode')     || 'range';
    const tooltipUnit   = sliderEl.getAttribute('data-tooltip')         || '';
    const customTagName = sliderEl.getAttribute('data-slider-tagname')  || category;

    const { minVal, maxVal } = getMinMaxFromItems(category);
    const startFrom = (minVal === Infinity)  ? 0   : minVal;
    const startTo   = (maxVal === -Infinity) ? 100 : maxVal;

    const sliderConfig = (mode === 'minonly')
      ? {
          start: [startFrom],
          connect: [true, false],
          range: { min: startFrom, max: startTo },
          step: 1,
          tooltips: [{ to: v => formatSliderTooltip(v, tooltipUnit) }]
        }
      : {
          start: [startFrom, startTo],
          connect: true,
          range: { min: startFrom, max: startTo },
          step: 1,
          tooltips: [
            { to: v => formatSliderTooltip(v, tooltipUnit) },
            { to: v => formatSliderTooltip(v, tooltipUnit) }
          ]
        };

    noUiSlider.create(sliderEl, sliderConfig);

    const fromInput = filterContainer.querySelector(`[custom-filter-field="${category}"][custom-filter-range="from"]`);
    const toInput   = filterContainer.querySelector(`[custom-filter-field="${category}"][custom-filter-range="to"]`);

    sliderEl.noUiSlider.on('update', values => {
      if (mode === 'minonly') {
        const val = parseFloat(values[0]) || 0;
        if (fromInput) fromInput.value = val;
        if (toInput)   toInput.value   = Number.MAX_SAFE_INTEGER;
      } else {
        const from = parseFloat(values[0]) || 0;
        const to   = parseFloat(values[1]) || 0;
        if (fromInput) fromInput.value = from;
        if (toInput)   toInput.value   = to;
      }
      applyFilters();
    });
  });
}
function getMinMaxFromItems(category) {
  let minVal = Infinity, maxVal = -Infinity;
  itemData.forEach(item => {
    if (item.fields[category]) {
      const num = parseFloat(item.fields[category][0]);
      if (!isNaN(num)) {
        if (num < minVal) minVal = num;
        if (num > maxVal) maxVal = num;
      }
    }
  });
  return { minVal, maxVal };
}
function formatSliderTooltip(v, unit) {
  const r = Math.round(v);
  return unit ? `${r} ${unit}` : String(r);
}

/* ───────────── MAIN FILTER PIPELINE ─────────────────────────────── */
function applyFilters() {
  console.log('[DEBUG] applyFilters() called.');
  listContainer.style.opacity = '0';

  // 1) Gather active filters
  const activeFilters = getActiveFilters();
  console.log('[DEBUG] Active filters:', activeFilters);

  // 2) Filter items
  const filteredItems = [];
  itemData.forEach(obj => {
    if (checkItemAgainstFilters(obj.fields, activeFilters)) {
      filteredItems.push(obj);
    } else {
      obj.element.style.display = 'none';
    }
  });

  // 3) Sort if needed
  const sortValue = getSortValue();
  if (sortValue) sortItems(filteredItems, sortValue);

  // 4) Re-inject into DOM
  reorderInDOM(filteredItems);

  // 5) UI updates
  const visibleCount   = filteredItems.length;
  const totalResultsEl = document.querySelector('[custom-filter-total="results"]');
  if (totalResultsEl) totalResultsEl.textContent = visibleCount;
  const totalItemsEl   = document.querySelector('[custom-filter-total="all"]');
  if (totalItemsEl)   totalItemsEl.textContent   = itemData.length;
  const emptyEl        = document.querySelector('[custom-filter-empty="true"]');
  if (emptyEl) emptyEl.style.display = (visibleCount === 0) ? '' : 'none';
  updateActiveTags(activeFilters);

  requestAnimationFrame(() => listContainer.style.opacity = '1');
}

/* ---- Gather active filters --------------------------------------- */
function getActiveFilters() {
  const filters = {};

  /* 1) Checkboxes & radios */
  filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
    if (!input.checked) return;

    const labelEl = input.closest('label');
    const spanEl  = labelEl?.querySelector('[custom-filter-field]');
    if (!spanEl) return;

    const cats = spanEl.getAttribute('custom-filter-field').split(',').map(c => c.trim());
    const val  = spanEl.textContent.toLowerCase().trim();
    cats.forEach(cat => {
      if (!filters[cat]) filters[cat] = { type: 'text', values: [], ids: [] };
      filters[cat].values.push(val);
      filters[cat].ids.push(input.id);
    });
  });

  /* 2) Wildcard input custom-filter-field="*" */
  const wildcardInput = filterContainer.querySelector(
    'input[custom-filter-field="*"], select[custom-filter-field="*"], textarea[custom-filter-field="*"]'
  );
  if (wildcardInput && wildcardInput.value.trim() !== '') {
    const typed = wildcardInput.value.trim().toLowerCase();
    if (!filters['*']) filters['*'] = { type: 'text', values: [] };
    filters['*'].values.push(typed);
  }

  /* 3) Other inputs (text, select, date, range) */
  filterContainer.querySelectorAll(
    'input[custom-filter-field]:not([type="checkbox"]):not([type="radio"]):not([custom-filter-field="*"]), \
     select[custom-filter-field]:not([custom-filter-field="*"]), \
     textarea[custom-filter-field]:not([custom-filter-field="*"])'
  ).forEach(input => {
    const cats = input.getAttribute('custom-filter-field').split(',').map(c => c.trim());
    const val  = input.value.trim();

    cats.forEach(cat => {
      if (!filters[cat]) filters[cat] = { type: 'text', values: [], ids: [] };

      if (input.hasAttribute('custom-filter-date') && val !== '') {
        filters[cat].type = 'date';
        const dateType = input.getAttribute('custom-filter-date');
        filters[cat][dateType] = new Date(val);
      }
      else if (input.hasAttribute('custom-filter-range') && val !== '') {
        filters[cat].type = 'range';
        const rangeType = input.getAttribute('custom-filter-range');
        filters[cat][rangeType] = parseFloat(val);
      }
      else if (val !== '') {
        filters[cat].values.push(val.toLowerCase());
      }
    });
  });

  /* 4) data-checkbox-logic="all" for AND logic */
  document.querySelectorAll('[custom-filter-auto]').forEach(el => {
    const cat = el.getAttribute('custom-filter-auto');
    const logicAttr = el.getAttribute('data-checkbox-logic');
    if (filters[cat] && logicAttr) {
      filters[cat].logic = (logicAttr.toLowerCase() === 'all') ? 'AND' : 'OR';
    }
  });

  /* 5) Remove empties */
  for (const cat in filters) {
    const f = filters[cat];
    if (f.type === 'text'  && f.values.length === 0) delete filters[cat];
    if (f.type === 'date'  && !f.from && !f.to)       delete filters[cat];
    if (f.type === 'range' && isNaN(f.from) && isNaN(f.to)) delete filters[cat];
  }
  return filters;
}

/* ---- Item vs. filters comparison (exact-match aware) -------------- */
function checkItemAgainstFilters(fields, filters) {
  for (const cat in filters) {
    const filter     = filters[cat];
    const itemValues = fields[cat] || [];
    const exactMatch = exactMatchCats.has(cat);

    if (filter.type === 'text') {
      /* Wildcard remains partial match */
      if (cat === '*') {
        const combined = Object.values(fields).flat().join(' ');
        for (const term of filter.values) if (!combined.includes(term)) return false;
        continue;
      }

      const logic = filter.logic || 'OR';
      const comparator = exactMatch
        ? (iv, term) => iv === term
        : (iv, term) => iv.includes(term);

      const valuePasses = (term) => itemValues.some(iv => comparator(iv, term));

      if (logic === 'AND') {
        if (!filter.values.every(valuePasses)) return false;
      } else {
        if (!filter.values.some(valuePasses))  return false;
      }
    }

    else if (filter.type === 'date') {
      const itemVal = itemValues[0];
      if (!itemVal) return false;
      const itemDate = new Date(itemVal);
      if (filter.from && itemDate < filter.from) return false;
      if (filter.to   && itemDate > filter.to)   return false;
    }

    else if (filter.type === 'range') {
      const num = parseFloat(itemValues[0]);
      if (isNaN(num)) return false;
      if (!isNaN(filter.from) && num < filter.from) return false;
      if (!isNaN(filter.to)   && num > filter.to)   return false;
    }
  }
  return true;
}

/* ───────────── ACTIVE TAGS UI ────────────────────────────────────── */
function updateActiveTags(filters) {
  const wrapper = document.querySelector('[custom-filter-tags="wrapper"]');
  if (!wrapper) return;

  wrapper.querySelectorAll('[custom-filter-tag="active"]').forEach(t => t.remove());

  const template = wrapper.querySelector('[custom-filter-tag="template"]');
  if (!template) return;

  for (const cat in filters) {
    const f = filters[cat];

    if (f.type === 'text') {
      if (cat === '*') {
        f.values.forEach(term => wrapper.appendChild(createTagElement(template, cat, term, false, null)));
        continue;
      }
      f.values.forEach((val, i) => {
        const id = f.ids?.[i] || null;
        wrapper.appendChild(createTagElement(template, cat, val, false, id));
      });
    }

    else if (f.type === 'date' || f.type === 'range') {
      const fromVal = !isNaN(f.from) ? f.from : '';
      const toVal   = !isNaN(f.to)   ? f.to   : '';

      const sliderEl = document.querySelector(`.my-range-slider[data-slider-category="${cat}"]`);
      const mode  = sliderEl?.getAttribute('data-slider-mode')    || 'range';
      const label = sliderEl?.getAttribute('data-slider-tagname') || cat;

      const text = (mode === 'minonly')
        ? `Min ${label}: ${fromVal || '…'}`
        : `${label}: ${fromVal || '…'} - ${toVal || '…'}`;

      wrapper.appendChild(createTagElement(template, cat, text, true));
    }
  }
}

function createTagElement(template, cat, val, isRangeOrDate = false, inputId = null) {
  const tag = template.cloneNode(true);
  tag.setAttribute('custom-filter-tag', 'active');
  tag.style.display = 'block';
  if (inputId) tag.setAttribute('data-checkbox-id', inputId);

  const textEl = tag.querySelector('[custom-filter-tag-text="true"]');
  if (textEl) textEl.textContent = val;

  const removeBtn = tag.querySelector('[custom-filter-tag-remove="true"]');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      if (isRangeOrDate) removeFilterRangeOrDate(cat);
      else               removeFilterValue(cat, val, inputId);
    });
  }
  return tag;
}

/* ---- Remove helpers ---------------------------------------------- */
function removeFilterValue(category, value, uniqueId = null) {
  console.log('[DEBUG] removeFilterValue ->', category, value, uniqueId);

  if (uniqueId) {
    const input = document.getElementById(uniqueId);
    if (input) {
      input.checked = false;
      const wfDiv = input.closest('label')?.querySelector('.w-checkbox-input');
      if (wfDiv) wfDiv.classList.remove('w--redirected-checked');
    }
  } else {
    filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
      if (!input.checked) return;
      const labelEl = input.closest('label');
      const spanEl  = labelEl?.querySelector(`[custom-filter-field*="${category}"]`);
      if (spanEl && spanEl.textContent.toLowerCase().trim() === value.toLowerCase()) {
        input.checked = false;
        const wfDiv = labelEl.querySelector('.w-checkbox-input');
        if (wfDiv) wfDiv.classList.remove('w--redirected-checked');
      }
    });
    filterContainer.querySelectorAll(
      `input[custom-filter-field*="${category}"]:not([type="checkbox"]):not([type="radio"]), \
       select[custom-filter-field*="${category}"], \
       textarea[custom-filter-field*="${category}"]`
    ).forEach(inp => {
      if (inp.value.toLowerCase().trim() === value.toLowerCase()) inp.value = '';
    });
  }
  applyFilters();
}
function removeFilterRangeOrDate(category) {
  console.log('[DEBUG] removeFilterRangeOrDate ->', category);

  const fromInput = filterContainer.querySelector(`[custom-filter-field*="${category}"][custom-filter-range="from"]`);
  const toInput   = filterContainer.querySelector(`[custom-filter-field*="${category}"][custom-filter-range="to"]`);
  if (fromInput) fromInput.value = '';
  if (toInput)   toInput.value   = '';

  const sliderEl = filterContainer.querySelector(`.my-range-slider[data-slider-category="${category}"]`);
  if (sliderEl && sliderEl.noUiSlider) {
    const mode = sliderEl.getAttribute('data-slider-mode') || 'range';
    const { minVal, maxVal } = getMinMaxFromItems(category);
    if (mode === 'minonly') sliderEl.noUiSlider.set([minVal]);
    else                    sliderEl.noUiSlider.set([minVal, maxVal]);
  }
  applyFilters();
}

/* ---- Reset / clear helpers --------------------------------------- */
function resetAllFilters() {
  console.log('[DEBUG] resetAllFilters');

  filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
    input.checked = false;
    input.closest('label')?.querySelector('.w-checkbox-input')?.classList.remove('w--redirected-checked');
  });

  filterContainer.querySelectorAll(
    'input[custom-filter-field]:not([type="checkbox"]):not([type="radio"]), \
     select[custom-filter-field], \
     textarea[custom-filter-field]'
  ).forEach(inp => inp.value = '');

  filterContainer.querySelectorAll('.my-range-slider').forEach(sliderEl => {
    if (sliderEl.noUiSlider) {
      const category = sliderEl.getAttribute('data-slider-category');
      const mode     = sliderEl.getAttribute('data-slider-mode') || 'range';
      const { minVal, maxVal } = getMinMaxFromItems(category);
      if (mode === 'minonly') sliderEl.noUiSlider.set([minVal]);
      else                    sliderEl.noUiSlider.set([minVal, maxVal]);
    }
  });
}
function clearCategoryFilter(category) {
  console.log('[DEBUG] clearCategoryFilter ->', category);

  filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
    const spanEl = input.closest('label')?.querySelector(`[custom-filter-field*="${category}"]`);
    if (spanEl) {
      input.checked = false;
      input.closest('label')?.querySelector('.w-checkbox-input')?.classList.remove('w--redirected-checked');
    }
  });

  filterContainer.querySelectorAll(
    `input[custom-filter-field*="${category}"]:not([type="checkbox"]):not([type="radio"]), \
     select[custom-filter-field*="${category}"], \
     textarea[custom-filter-field*="${category}"]`
  ).forEach(inp => inp.value = '');

  const sliderEl = filterContainer.querySelector(`.my-range-slider[data-slider-category="${category}"]`);
  if (sliderEl && sliderEl.noUiSlider) {
    const mode = sliderEl.getAttribute('data-slider-mode') || 'range';
    const { minVal, maxVal } = getMinMaxFromItems(category);
    if (mode === 'minonly') sliderEl.noUiSlider.set([minVal]);
    else                    sliderEl.noUiSlider.set([minVal, maxVal]);
  }
  applyFilters();
}

/* ---- Utility ------------------------------------------------------ */
const capitalize = str => (!str ? '' : str.charAt(0).toUpperCase() + str.slice(1));

/* ───────────── SORTING HELPERS ───────────────────────────────────── */
function getSortValue() {
  const sel = document.querySelector('[custom-filter-sort="true"]');
  if (!sel) return null;
  const v = sel.value.trim();
  return v || null;     // e.g. "price-asc"
}
function sortItems(arr, sortValue) {
  const [field, dir] = sortValue.split('-');
  arr.sort((a, b) => {
    const aVal = a.fields[field]?.[0] || '';
    const bVal = b.fields[field]?.[0] || '';

    const aNum = parseFloat(aVal);
    const bNum = parseFloat(bVal);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      return (dir === 'asc') ? (aNum - bNum) : (bNum - aNum);
    }
    return (dir === 'asc') ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });
}
function reorderInDOM(sortedItems) {
  sortedItems.forEach(obj => {
    listContainer.appendChild(obj.element);
    obj.element.style.display = '';
  });
}

/* ───────────── BOOTSTRAP (optional) ────────────────────────────────
   If you prefer automatic init when the page is ready, uncomment:
   -------------------------------------------------------------------
   document.addEventListener('DOMContentLoaded', initializeFilters);
   -------------------------------------------------------------------
   Otherwise, call initializeFilters() yourself after dynamic data load.
   ─────────────────────────────────────────────────────────────────── */