// Global references
let filterContainer;
let listContainer;
let itemData = [];

/**
 * Call this after your items are in the DOM (e.g., after Wized data load).
 */
function initializeFilters() {
  console.log('[DEBUG] initializeFilters() called.');

  // Find your containers
  filterContainer = document.querySelector('[custom-filter="filters"]');
  listContainer   = document.querySelector('[custom-filter="list"]');
  if (!filterContainer || !listContainer) {
    console.warn('[DEBUG] Missing filter container or list container.');
    return;
  }

  // 1) Collect item data
  itemData = collectItemData(listContainer);
  console.log('[DEBUG] itemData:', itemData);

  // 2) Auto-populate filters (checkbox/radio/select if needed)
  setupAutoPopulatedFilters();

  // 3) Setup range sliders
  setupRangeSliders();

  // 4) Listen for input/change in the filter container
  const formHasSubmit = filterContainer.querySelector('[custom-filter-submit="true"]');
  if (formHasSubmit) {
    filterContainer.addEventListener('submit', e => {
      e.preventDefault();
      applyFilters();
    });
  } else {
    filterContainer.addEventListener('input', () => applyFilters());
    filterContainer.addEventListener('change', () => applyFilters());
  }

  // 5) Clear All / Clear Category
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

  // [SORTING OUTSIDE FILTER CONTAINER]
  // If your sort select is outside [custom-filter="filters"], do a global query:
  const sortSelect = document.querySelector('[custom-filter-sort="true"]');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      console.log('[DEBUG] Global sort changed to:', sortSelect.value);
      applyFilters();
    });
  }

  // 6) Initial apply
  applyFilters();
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
      const cats = el.getAttribute('custom-filter-field').split(',').map(c => c.trim());
      cats.forEach(cat => {
        fields[cat] = fields[cat] || [];
        // Convert text to lowercase for easier matching
        fields[cat].push(el.textContent.toLowerCase().trim());
      });
    });
    return { element: item, fields };
  });
}

/**
 * Auto-populate filters (checkbox/radio/select),
 * skipping empty data values, plus optional template-based approach.
 */
function setupAutoPopulatedFilters() {
  const autoFilters = filterContainer.querySelectorAll('[custom-filter-auto]');
  autoFilters.forEach(autoEl => {
    const category    = autoEl.getAttribute('custom-filter-auto');
    const autoType    = autoEl.getAttribute('data-auto-type') || 'select';
    const useTemplate = autoEl.hasAttribute('data-auto-template');

    // Gather unique values for this category
    const uniqueVals = new Set();
    itemData.forEach(item => {
      if (item.fields[category]) {
        item.fields[category].forEach(val => uniqueVals.add(val));
      }
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

/** Simple approach: fill a <select> or build label+checkbox/radio from scratch */
function autoPopulateSimple(autoEl, category, autoType, sortedValues) {
  if (autoType === 'select') {
    // Expect autoEl to be a <select>
    if (autoEl.tagName.toLowerCase() === 'select') {
      autoEl.innerHTML = '';
      // Insert a default placeholder
      const placeholderText = autoEl.getAttribute('data-placeholder') || `Choose ${capitalize(category)}`;
      const def = document.createElement('option');
      def.value = '';
      def.textContent = placeholderText;
      def.disabled = true;
      def.selected = true;
      autoEl.appendChild(def);

      sortedValues.forEach((val, index) => {
        if (!val.trim()) return; // skip empty
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = capitalize(val);
        autoEl.appendChild(opt);
      });

      // Ensure it has custom-filter-field if missing
      if (!autoEl.hasAttribute('custom-filter-field')) {
        autoEl.setAttribute('custom-filter-field', category);
      }
    } else {
      console.warn(`[DEBUG] data-auto-type="select" but element is not <select>. Category: ${category}`);
    }
  }
  else if (autoType === 'checkbox' || autoType === 'radio') {
    // Generate checkboxes/radios
    autoEl.innerHTML = '';
    sortedValues.forEach((val, index) => {
      if (!val.trim()) return; // skip empty

      const label = document.createElement('label');
      label.style.display = 'block';

      // Webflow style container
      const wfCheckboxDiv = document.createElement('div');
      wfCheckboxDiv.classList.add('w-checkbox-input', 'w-checkbox-input--inputType-custom');

      const input = document.createElement('input');
      input.type = autoType;
      const uniqueId = `checkbox-${category}-${index}`;
      input.id = uniqueId;
      input.value = val;
      // Hide the real input per Webflow style
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

/** Template-based approach if data-auto-template is used. */
function autoPopulateWithTemplate(autoEl, category, autoType, sortedValues) {
  const templateItem = autoEl.querySelector('[data-auto-template-item]');
  if (!templateItem) {
    console.warn(`[DEBUG] No [data-auto-template-item] found for category "${category}".`);
    return;
  }

  // Remove siblings except the template
  const siblings = [...autoEl.children].filter(ch => ch !== templateItem);
  siblings.forEach(sib => sib.remove());

  sortedValues.forEach((val, index) => {
    if (!val.trim()) return;

    const clone = templateItem.cloneNode(true);
    clone.style.display = 'block';

    // Remove "checked" style if the template had it
    const wfCheckboxDiv = clone.querySelector('.w-checkbox-input');
    if (wfCheckboxDiv && wfCheckboxDiv.classList.contains('w--redirected-checked')) {
      wfCheckboxDiv.classList.remove('w--redirected-checked');
    }

    const input = clone.querySelector('input[type="checkbox"], input[type="radio"]');
    if (input) {
      input.type = autoType;
      const uniqueId = `checkbox-${category}-${index}`;
      input.id = uniqueId;
      input.value = val;
      input.checked = false;
    }

    const span = clone.querySelector(`[custom-filter-field="${category}"]`);
    if (span) {
      span.textContent = capitalize(val);
    } else {
      const fallbackSpan = clone.querySelector('[custom-filter-field]');
      if (fallbackSpan) fallbackSpan.textContent = capitalize(val);
    }

    autoEl.appendChild(clone);
  });

  templateItem.style.display = 'none';
}

/**
 * Setup range sliders: data-slider-mode="range" or "minonly".
 * data-slider-tagname: name used in active tags.
 */
function setupRangeSliders() {
  if (!window.noUiSlider) {
    console.warn('[DEBUG] noUiSlider not found, skipping slider creation.');
    return;
  }

  const sliders = filterContainer.querySelectorAll('.my-range-slider');
  sliders.forEach(sliderEl => {
    const category = sliderEl.getAttribute('data-slider-category') || 'undefined';
    const mode     = sliderEl.getAttribute('data-slider-mode') || 'range';
    const tooltipUnit  = sliderEl.getAttribute('data-tooltip') || '';
    const customTagName= sliderEl.getAttribute('data-slider-tagname') || category;

    const { minVal, maxVal } = getMinMaxFromItems(category);
    const startFrom = (minVal === Infinity) ? 0   : minVal;
    const startTo   = (maxVal === -Infinity)? 100 : maxVal;

    let sliderConfig;
    if (mode === 'minonly') {
      sliderConfig = {
        start: [startFrom],
        connect: [true, false],
        range: { min: startFrom, max: startTo },
        step: 1,
        tooltips: [{ to: val => formatSliderTooltip(val, tooltipUnit) }]
      };
    } else {
      sliderConfig = {
        start: [startFrom, startTo],
        connect: true,
        range: { min: startFrom, max: startTo },
        step: 1,
        tooltips: [
          { to: val => formatSliderTooltip(val, tooltipUnit) },
          { to: val => formatSliderTooltip(val, tooltipUnit) }
        ]
      };
    }

    noUiSlider.create(sliderEl, sliderConfig);

    const fromInput = filterContainer.querySelector(`[custom-filter-field="${category}"][custom-filter-range="from"]`);
    const toInput   = filterContainer.querySelector(`[custom-filter-field="${category}"][custom-filter-range="to"]`);

    sliderEl.noUiSlider.on('update', values => {
      if (mode === 'minonly') {
        const val = parseFloat(values[0]) || 0;
        if (fromInput) fromInput.value = val;
        if (toInput)   toInput.value   = Number.MAX_SAFE_INTEGER; // effectively infinite
      } else {
        const valFrom = parseFloat(values[0]) || 0;
        const valTo   = parseFloat(values[1]) || 0;
        if (fromInput) fromInput.value = valFrom;
        if (toInput)   toInput.value   = valTo;
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

function formatSliderTooltip(value, unit) {
  const rounded = Math.round(value);
  return unit ? `${rounded} ${unit}` : String(rounded);
}

/**
 * Main filtering function
 */
function applyFilters() {
  console.log('[DEBUG] applyFilters() called.');
  listContainer.style.opacity = '0';

  // 1) Get filters
  const activeFilters = getActiveFilters();
  console.log('[DEBUG] Active filters:', activeFilters);

  // 2) Filter items
  let filteredItems = [];
  itemData.forEach(obj => {
    const matches = checkItemAgainstFilters(obj.fields, activeFilters);
    if (matches) {
      filteredItems.push(obj);
    } else {
      obj.element.style.display = 'none';
    }
  });

  // 3) SORTING ADDITIONS: read sort value (globally), then sort
  const sortValue = getSortValue(); // e.g. "price-asc" or null
  if (sortValue) {
    sortItems(filteredItems, sortValue);
  }

  // 4) reorder in DOM + show them
  reorderInDOM(filteredItems);

  // 5) Update totals
  const visibleCount = filteredItems.length;
  const totalResultsEl = document.querySelector('[custom-filter-total="results"]');
  if (totalResultsEl) totalResultsEl.textContent = visibleCount;

  const totalItemsEl = document.querySelector('[custom-filter-total="all"]');
  if (totalItemsEl) totalItemsEl.textContent = itemData.length;

  // 6) Show/hide empty
  const emptyEl = document.querySelector('[custom-filter-empty="true"]');
  if (emptyEl) emptyEl.style.display = (visibleCount === 0) ? '' : 'none';

  // 7) Update active tags
  updateActiveTags(activeFilters);

  requestAnimationFrame(() => listContainer.style.opacity = '1');
}

/**
 * Gather currently active filters. 
 * Also handle wildcard (custom-filter-field="*") and data-checkbox-logic="all".
 */
function getActiveFilters() {
  const filters = {};

  // Checkboxes/radios
  const checkboxes = filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  checkboxes.forEach(input => {
    if (input.checked) {
      const labelEl = input.closest('label');
      if (labelEl) {
        const spanEl = labelEl.querySelector('[custom-filter-field]');
        if (spanEl) {
          const cats = spanEl.getAttribute('custom-filter-field').split(',').map(c => c.trim());
          const val  = spanEl.textContent.toLowerCase().trim();
          cats.forEach(cat => {
            if (!filters[cat]) filters[cat] = { type: 'text', values: [], ids: [] };
            filters[cat].values.push(val);
            filters[cat].ids.push(input.id);
          });
        }
      }
    }
  });

  // 2) Wildcard input: custom-filter-field="*"
  const wildcardInput = filterContainer.querySelector('input[custom-filter-field="*"], select[custom-filter-field="*"], textarea[custom-filter-field="*"]');
  if (wildcardInput && wildcardInput.value.trim() !== '') {
    const typed = wildcardInput.value.trim().toLowerCase();
    if (!filters['*']) filters['*'] = { type: 'text', values: [] };
    filters['*'].values.push(typed);
  }

  // 3) Other text/select/date/range inputs (excluding wildcard)
  const otherInputs = filterContainer.querySelectorAll(
    'input[custom-filter-field]:not([type="checkbox"]):not([type="radio"]):not([custom-filter-field="*"]), \
     select[custom-filter-field]:not([custom-filter-field="*"]), \
     textarea[custom-filter-field]:not([custom-filter-field="*"])'
  );
  otherInputs.forEach(input => {
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

  // 4) data-checkbox-logic => "all" for AND logic
  document.querySelectorAll('[custom-filter-auto]').forEach(el => {
    const cat = el.getAttribute('custom-filter-auto');
    const logicAttr = el.getAttribute('data-checkbox-logic'); 
    if (filters[cat] && logicAttr) {
      filters[cat].logic = (logicAttr.toLowerCase() === 'all') ? 'AND' : 'OR';
    }
  });

  // 5) Clean out empties
  for (const cat in filters) {
    const f = filters[cat];
    if (f.type === 'text' && f.values.length === 0) {
      delete filters[cat];
    }
    if (f.type === 'date' && !f.from && !f.to) {
      delete filters[cat];
    }
    if (f.type === 'range' && isNaN(f.from) && isNaN(f.to)) {
      delete filters[cat];
    }
  }
  return filters;
}

/**
 * Check each item against the active filters.
 */
function checkItemAgainstFilters(fields, filters) {
  for (const cat in filters) {
    const filter = filters[cat];
    const itemValues = fields[cat] || [];

    if (filter.type === 'text') {
      // If wildcard
      if (cat === '*') {
        let combinedText = Object.keys(fields)
          .map(k => fields[k].join(' '))
          .join(' ')
          .toLowerCase();
        for (const typedTerm of filter.values) {
          if (!combinedText.includes(typedTerm)) {
            return false;
          }
        }
        continue;
      }

      // Normal text logic
      const logicMode = filter.logic || 'OR';
      if (filter.values.length > 1) {
        if (logicMode === 'AND') {
          for (const val of filter.values) {
            if (!itemValues.some(iv => iv.includes(val))) {
              return false;
            }
          }
        } else {
          let match = false;
          for (const val of filter.values) {
            if (itemValues.some(iv => iv.includes(val))) {
              match = true;
              break;
            }
          }
          if (!match) return false;
        }
      } else if (filter.values.length === 1) {
        const searchTerm = filter.values[0];
        const combined = itemValues.join(' ');
        if (!combined.includes(searchTerm)) return false;
      }
    }
    else if (filter.type === 'date') {
      const itemVal = itemValues[0];
      if (!itemVal) return false;
      const itemDate = new Date(itemVal);
      if (filter.from && itemDate < filter.from) return false;
      if (filter.to && itemDate > filter.to)     return false;
    }
    else if (filter.type === 'range') {
      const itemVal = parseFloat(itemValues[0]);
      if (isNaN(itemVal)) return false;
      if (!isNaN(filter.from) && itemVal < filter.from) return false;
      if (!isNaN(filter.to)   && itemVal > filter.to)   return false;
    }
  }
  return true;
}

/**
 * Update (or build) the active tags in the UI.
 */
function updateActiveTags(filters) {
  const tagsWrapper = document.querySelector('[custom-filter-tags="wrapper"]');
  if (!tagsWrapper) return;

  // Remove old tags
  tagsWrapper.querySelectorAll('[custom-filter-tag="active"]').forEach(tag => tag.remove());

  const template = tagsWrapper.querySelector('[custom-filter-tag="template"]');
  if (!template) return;

  for (const cat in filters) {
    const filter = filters[cat];

    if (filter.type === 'text') {
      // If wildcard
      if (cat === '*') {
        filter.values.forEach(searchTerm => {
          const newTag = createTagElement(template, cat, searchTerm, false, null);
          tagsWrapper.appendChild(newTag);
        });
        continue;
      }

      // Normal text-based
      filter.values.forEach((val, i) => {
        const inputId = filter.ids?.[i] || null;
        const newTag = createTagElement(template, cat, val, false, inputId);
        tagsWrapper.appendChild(newTag);
      });
    }
    else if (filter.type === 'date' || filter.type === 'range') {
      const fromVal = !isNaN(filter.from) ? filter.from : '';
      const toVal   = !isNaN(filter.to)   ? filter.to   : '';

      const sliderEl = document.querySelector(`.my-range-slider[data-slider-category="${cat}"]`);
      const mode = sliderEl?.getAttribute('data-slider-mode') || 'range';
      const label= sliderEl?.getAttribute('data-slider-tagname') || cat;

      let displayText;
      if (mode === 'minonly') {
        displayText = `Min ${label}: ${fromVal || '...'}`;
      } else {
        displayText = `${label}: ${fromVal || '...'} - ${toVal || '...'}`;
      }
      const newTag = createTagElement(template, cat, displayText, true);
      tagsWrapper.appendChild(newTag);
    }
  }
}

/**
 * Create a cloned tag from the template.
 * For checkboxes, we store inputId so removing the tag can uncheck that box.
 */
function createTagElement(template, cat, val, isRangeOrDate = false, inputId = null) {
  const newTag = template.cloneNode(true);
  newTag.setAttribute('custom-filter-tag', 'active');
  newTag.style.display = 'block';

  if (inputId) {
    newTag.setAttribute('data-checkbox-id', inputId);
  }

  const textEl = newTag.querySelector('[custom-filter-tag-text="true"]');
  if (textEl) {
    textEl.textContent = val;
  }

  const removeBtn = newTag.querySelector('[custom-filter-tag-remove="true"]');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      if (isRangeOrDate) {
        removeFilterRangeOrDate(cat);
      } else {
        removeFilterValue(cat, val, inputId);
      }
    });
  }
  return newTag;
}

/**
 * Remove a single text-based filter (like a checkbox).
 */
function removeFilterValue(category, value, uniqueId = null) {
  console.log('[DEBUG] removeFilterValue ->', category, value, uniqueId);

  if (uniqueId) {
    // Uncheck the specific input by ID
    const input = document.getElementById(uniqueId);
    if (input) {
      input.checked = false;
      // Remove Webflow styling
      const labelEl = input.closest('label');
      if (labelEl) {
        const wfCheckboxDiv = labelEl.querySelector('.w-checkbox-input');
        if (wfCheckboxDiv && wfCheckboxDiv.classList.contains('w--redirected-checked')) {
          wfCheckboxDiv.classList.remove('w--redirected-checked');
        }
      }
    }
  } else {
    // fallback if no ID known
    const checkboxes = filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    checkboxes.forEach(input => {
      if (input.checked) {
        const labelEl = input.closest('label');
        if (!labelEl) return;
        const spanEl = labelEl.querySelector(`[custom-filter-field*="${category}"]`);
        if (spanEl && spanEl.textContent.toLowerCase().trim() === value.toLowerCase()) {
          input.checked = false;
          const wfBoxDiv = labelEl.querySelector('.w-checkbox-input');
          if (wfBoxDiv && wfBoxDiv.classList.contains('w--redirected-checked')) {
            wfBoxDiv.classList.remove('w--redirected-checked');
          }
        }
      }
    });
    // Also clear any text input matches
    const inputs = filterContainer.querySelectorAll(
      `input[custom-filter-field*="${category}"]:not([type="checkbox"]):not([type="radio"]),
       select[custom-filter-field*="${category}"],
       textarea[custom-filter-field*="${category}"]`
    );
    inputs.forEach(input => {
      if (input.value.toLowerCase().trim() === value.toLowerCase()) {
        input.value = '';
      }
    });
  }

  applyFilters();
}

/**
 * Remove a date or range filter
 */
function removeFilterRangeOrDate(category) {
  console.log('[DEBUG] removeFilterRangeOrDate ->', category);

  const fromInput = filterContainer.querySelector(`[custom-filter-field*="${category}"][custom-filter-range="from"]`);
  const toInput   = filterContainer.querySelector(`[custom-filter-field*="${category}"][custom-filter-range="to"]`);
  if (fromInput) fromInput.value = '';
  if (toInput)   toInput.value   = '';

  // Reset slider if it exists
  const sliderEl = filterContainer.querySelector(`.my-range-slider[data-slider-category="${category}"]`);
  if (sliderEl && sliderEl.noUiSlider) {
    const mode = sliderEl.getAttribute('data-slider-mode') || 'range';
    const { minVal, maxVal } = getMinMaxFromItems(category);
    if (mode === 'minonly') {
      sliderEl.noUiSlider.set([minVal]);
    } else {
      sliderEl.noUiSlider.set([minVal, maxVal]);
    }
  }

  applyFilters();
}

/**
 * Reset all filters
 */
function resetAllFilters() {
  console.log('[DEBUG] resetAllFilters');

  // Uncheck checkboxes
  const checkboxes = filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  checkboxes.forEach(input => {
    input.checked = false;
    // remove w--redirected-checked
    const labelEl = input.closest('label');
    if (labelEl) {
      const wfBoxDiv = labelEl.querySelector('.w-checkbox-input');
      if (wfBoxDiv && wfBoxDiv.classList.contains('w--redirected-checked')) {
        wfBoxDiv.classList.remove('w--redirected-checked');
      }
    }
  });

  // Clear text, select, etc.
  const inputs = filterContainer.querySelectorAll(
    'input[custom-filter-field]:not([type="checkbox"]):not([type="radio"]), \
     select[custom-filter-field], \
     textarea[custom-filter-field]'
  );
  inputs.forEach(input => {
    input.value = '';
  });

  // Reset sliders
  const sliderEls = filterContainer.querySelectorAll('.my-range-slider');
  sliderEls.forEach(sliderEl => {
    if (sliderEl.noUiSlider) {
      const category = sliderEl.getAttribute('data-slider-category');
      const mode     = sliderEl.getAttribute('data-slider-mode') || 'range';
      const { minVal, maxVal } = getMinMaxFromItems(category);
      if (mode === 'minonly') {
        sliderEl.noUiSlider.set([minVal]);
      } else {
        sliderEl.noUiSlider.set([minVal, maxVal]);
      }
    }
  });
}

/**
 * Clear a specific category
 */
function clearCategoryFilter(category) {
  console.log('[DEBUG] clearCategoryFilter ->', category);

  // Uncheck checkboxes
  const checkboxes = filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  checkboxes.forEach(input => {
    const labelEl = input.closest('label');
    if (!labelEl) return;
    const spanEl = labelEl.querySelector(`[custom-filter-field*="${category}"]`);
    if (spanEl) {
      input.checked = false;
      // remove w--redirected-checked
      const wfBoxDiv = labelEl.querySelector('.w-checkbox-input');
      if (wfBoxDiv && wfBoxDiv.classList.contains('w--redirected-checked')) {
        wfBoxDiv.classList.remove('w--redirected-checked');
      }
    }
  });

  // Clear text inputs
  const inputs = filterContainer.querySelectorAll(
    `input[custom-filter-field*="${category}"]:not([type="checkbox"]):not([type="radio"]),
     select[custom-filter-field*="${category}"],
     textarea[custom-filter-field*="${category}"]`
  );
  inputs.forEach(input => {
    input.value = '';
  });

  // Reset slider if present
  const sliderEl = filterContainer.querySelector(`.my-range-slider[data-slider-category="${category}"]`);
  if (sliderEl && sliderEl.noUiSlider) {
    const mode = sliderEl.getAttribute('data-slider-mode') || 'range';
    const { minVal, maxVal } = getMinMaxFromItems(category);
    if (mode === 'minonly') {
      sliderEl.noUiSlider.set([minVal]);
    } else {
      sliderEl.noUiSlider.set([minVal, maxVal]);
    }
  }
  applyFilters();
}

/** Utility: capitalizes first letter. */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =================== SORTING ADDITIONS ===================

/**
 * Returns the current sort value from a global <select custom-filter-sort="true">,
 * for example "price-asc" or null if none is selected.
 */
function getSortValue() {
  // Query globally, not within filterContainer
  const sortSelect = document.querySelector('[custom-filter-sort="true"]');
  if (!sortSelect) return null;
  const val = sortSelect.value.trim();
  if (!val) return null; 
  return val;  // e.g. "price-asc"
}

/**
 * Sorts the array of item objects in place, given a sortValue like "price-asc".
 * If numeric parse is possible, we do numeric sort; otherwise string sort.
 */
function sortItems(filteredItems, sortValue) {
  const [field, dir] = sortValue.split('-'); // e.g. "price-asc" => field="price", dir="asc"

  filteredItems.sort((a, b) => {
    const aVal = a.fields[field]?.[0] || '';
    const bVal = b.fields[field]?.[0] || '';

    // Try numeric parse
    const aNum = parseFloat(aVal);
    const bNum = parseFloat(bVal);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      // numeric
      return (dir === 'asc') ? (aNum - bNum) : (bNum - aNum);
    } else {
      // fallback string
      if (dir === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    }
  });
}

/**
 * Re-injects the sorted items into the DOM, setting display=""
 */
function reorderInDOM(sortedItems) {
  sortedItems.forEach(itemObj => {
    listContainer.appendChild(itemObj.element);
    itemObj.element.style.display = '';
  });
}
