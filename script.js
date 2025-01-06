// Global references
let filterContainer;
let listContainer;
let itemData = [];

/**
 * Call this function once your items are in the DOM (e.g. after Wized data load).
 */
function initializeFilters() {
  console.log('[DEBUG] initializeFilters() called.');

  filterContainer = document.querySelector('[custom-filter="filters"]');
  listContainer   = document.querySelector('[custom-filter="list"]');
  if (!filterContainer || !listContainer) {
    console.warn('[DEBUG] Missing [custom-filter="filters"] or [custom-filter="list"].');
    return;
  }

  // 1) Collect item data from the list
  itemData = collectItemData(listContainer);
  console.log('[DEBUG] itemData:', itemData);

  // 2) Auto-populate filters (checkbox/radio/select) 
  setupAutoPopulatedFilters();

  // 3) Setup range sliders (noUiSlider)
  setupRangeSliders();

  // 4) Listen for input/change
  const formHasSubmit = filterContainer.querySelector('[custom-filter-submit="true"]');
  if (formHasSubmit) {
    filterContainer.addEventListener('submit', (e) => {
      e.preventDefault();
      applyFilters();
    });
  } else {
    filterContainer.addEventListener('input', () => applyFilters());
    filterContainer.addEventListener('change', () => applyFilters());
  }

  // 5) Clear filters
  filterContainer.querySelectorAll('[custom-filter-clear="all"]').forEach(btn => {
    btn.addEventListener('click', () => {
      resetAllFilters();
      applyFilters();
    });
  });
  filterContainer.querySelectorAll('[custom-filter-clear]:not([custom-filter-clear="all"])').forEach(btn => {
    const cat = btn.getAttribute('custom-filter-clear');
    btn.addEventListener('click', () => {
      clearCategoryFilter(cat);
      applyFilters();
    });
  });

  // 6) Initial filtering
  applyFilters();
}

/**
 * Gather all items from [custom-filter-item], storing text from [custom-filter-field].
 */
function collectItemData(container) {
  const items = [...container.querySelectorAll('[custom-filter-item]')];
  return items.map(item => {
    const fields = {};
    item.querySelectorAll('[custom-filter-field]').forEach(el => {
      const cats = el.getAttribute('custom-filter-field').split(',').map(c => c.trim());
      cats.forEach(cat => {
        fields[cat] = fields[cat] || [];
        fields[cat].push(el.textContent.toLowerCase().trim());
      });
    });
    return { element: item, fields };
  });
}

/**
 * Auto-populate checkboxes/radios/select for elements with [custom-filter-auto].
 * - data-auto-type="checkbox" | "radio" | "select"
 * - data-auto-template => use a hidden template item
 * - data-checkbox-logic="all" => "AND" logic for multiple checked boxes
 */
function setupAutoPopulatedFilters() {
  const autoFilters = filterContainer.querySelectorAll('[custom-filter-auto]');
  autoFilters.forEach(autoEl => {
    const category    = autoEl.getAttribute('custom-filter-auto');
    const autoType    = autoEl.getAttribute('data-auto-type') || 'select';
    const useTemplate = autoEl.hasAttribute('data-auto-template');

    // Get all unique values for that category
    const uniqueVals = new Set();
    itemData.forEach(item => {
      if (item.fields[category]) {
        item.fields[category].forEach(val => uniqueVals.add(val));
      }
    });
    const sortedVals = [...uniqueVals].sort();

    if (sortedVals.length === 0) {
      console.log(`[DEBUG] No values found for category "${category}". Skipping auto-population.`);
      return;
    }

    if (useTemplate) {
      autoPopulateWithTemplate(autoEl, category, autoType, sortedVals);
    } else {
      autoPopulateSimple(autoEl, category, autoType, sortedVals);
    }
  });
}

/**
 * Simple approach: fill a <select> with <option>, or generate label+checkbox/radio from scratch
 */
function autoPopulateSimple(autoEl, category, autoType, sortedValues) {
  if (autoType === 'select') {
    // Expect autoEl to be a <select>
    if (autoEl.tagName.toLowerCase() === 'select') {
      autoEl.innerHTML = '';

      // default option
      const def = document.createElement('option');
      def.value = '';
      def.textContent = 'Velg en...'; // or "All"
      autoEl.appendChild(def);

      // For each unique value, skip empty
      sortedValues.forEach(val => {
        if (!val.trim()) return; // skip empty strings
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = capitalize(val);
        autoEl.appendChild(opt);
      });

      // Ensure custom-filter-field is set
      if (!autoEl.hasAttribute('custom-filter-field')) {
        autoEl.setAttribute('custom-filter-field', category);
      }

    } else {
      console.warn(`[DEBUG] data-auto-type="select" but element is not a <select>. Category: ${category}`);
    }
  }
  else if (autoType === 'checkbox' || autoType === 'radio') {
    // Generate label+input from scratch
    autoEl.innerHTML = '';
    sortedValues.forEach(val => {
      if (!val.trim()) return; // skip empty
      const label = document.createElement('label');
      label.style.display = 'block';

      const input = document.createElement('input');
      input.type = autoType;
      // mimic Webflow style if needed
      input.style.opacity = '0';
      input.style.position = 'absolute';
      input.style.zIndex   = '-1';

      const span = document.createElement('span');
      span.setAttribute('custom-filter-field', category);
      span.textContent = capitalize(val);

      label.appendChild(input);
      label.appendChild(span);
      autoEl.appendChild(label);
    });
  }
}

/**
 * Template-based approach: clone a hidden [data-auto-template-item]
 */
function autoPopulateWithTemplate(autoEl, category, autoType, sortedValues) {
  const templateItem = autoEl.querySelector('[data-auto-template-item]');
  if (!templateItem) {
    console.warn(`[DEBUG] No [data-auto-template-item] found for category "${category}".`);
    return;
  }

  // Remove siblings except the template
  const siblings = [...autoEl.children].filter(ch => ch !== templateItem);
  siblings.forEach(sib => sib.remove());

  // For each unique value, skip empty
  sortedValues.forEach(val => {
    if (!val.trim()) return; // skip empty
    const clone = templateItem.cloneNode(true);
    clone.style.display = '';

    // Find the <span> or element with custom-filter-field
    const span = clone.querySelector(`[custom-filter-field="${category}"]`);
    if (span) {
      span.textContent = capitalize(val);
    } else {
      // fallback if no exact match
      const fallback = clone.querySelector('[custom-filter-field]');
      if (fallback) fallback.textContent = capitalize(val);
    }

    // Ensure input type
    const input = clone.querySelector('input[type="checkbox"], input[type="radio"]');
    if (input) {
      input.type = autoType;
    }

    autoEl.appendChild(clone);
  });

  templateItem.style.display = 'none';
}

/**
 * Range sliders using noUiSlider
 * - data-slider-category="[category]"
 * - data-slider-mode="range" or "minonly"
 */
function setupRangeSliders() {
  if (!window.noUiSlider) {
    console.warn('[DEBUG] noUiSlider not found, skipping slider setup.');
    return;
  }

  const sliders = filterContainer.querySelectorAll('.my-range-slider');
  sliders.forEach(sliderEl => {
    const category   = sliderEl.getAttribute('data-slider-category') || 'undefined';
    const mode       = sliderEl.getAttribute('data-slider-mode') || 'range';
    const tooltipUnit= sliderEl.getAttribute('data-tooltip') || '';

    const { minVal, maxVal } = getMinMaxFromItems(category);
    const startFrom = (minVal === Infinity) ? 0   : minVal;
    const startTo   = (maxVal === -Infinity)? 100 : maxVal;

    let sliderConfig;
    if (mode === 'minonly') {
      // Single-handle
      sliderConfig = {
        start: [startFrom],
        connect: [true, false],
        range: { min: startFrom, max: startTo },
        step: 1,
        tooltips: [{ to: (val) => formatSliderTooltip(val, tooltipUnit) }]
      };
    } else {
      // Two-handle
      sliderConfig = {
        start: [startFrom, startTo],
        connect: true,
        range: { min: startFrom, max: startTo },
        step: 1,
        tooltips: [
          { to: (val) => formatSliderTooltip(val, tooltipUnit) },
          { to: (val) => formatSliderTooltip(val, tooltipUnit) }
        ]
      };
    }

    noUiSlider.create(sliderEl, sliderConfig);

    const fromInput = filterContainer.querySelector(`[custom-filter-field="${category}"][custom-filter-range="from"]`);
    const toInput   = filterContainer.querySelector(`[custom-filter-field="${category}"][custom-filter-range="to"]`);

    sliderEl.noUiSlider.on('update', (values) => {
      if (mode === 'minonly') {
        const val = parseFloat(values[0]);
        if (fromInput) fromInput.value = val;
        if (toInput)   toInput.value   = Number.MAX_SAFE_INTEGER;
      } else {
        const valFrom = parseFloat(values[0]);
        const valTo   = parseFloat(values[1]);
        if (fromInput) fromInput.value = valFrom;
        if (toInput)   toInput.value   = valTo;
      }
      applyFilters();
    });
  });
}

function getMinMaxFromItems(category) {
  let minVal = Infinity;
  let maxVal = -Infinity;
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
 * Apply all filters to show/hide items
 */
function applyFilters() {
  console.log('[DEBUG] applyFilters() called.');
  listContainer.style.opacity = '0';

  const activeFilters = getActiveFilters();
  console.log('[DEBUG] Active filters:', activeFilters);

  let visibleCount = 0;
  itemData.forEach(obj => {
    const matches = checkItemAgainstFilters(obj.fields, activeFilters);
    if (matches) {
      obj.element.style.display = '';
      visibleCount++;
    } else {
      obj.element.style.display = 'none';
    }
  });

  // update totals
  const totalResultsEl = document.querySelector('[custom-filter-total="results"]');
  if (totalResultsEl) totalResultsEl.textContent = visibleCount;
  const totalItemsEl = document.querySelector('[custom-filter-total="all"]');
  if (totalItemsEl) totalItemsEl.textContent = itemData.length;

  // empty state
  const emptyEl = document.querySelector('[custom-filter-empty="true"]');
  if (emptyEl) emptyEl.style.display = (visibleCount === 0) ? '' : 'none';

  updateActiveTags(activeFilters);

  requestAnimationFrame(() => listContainer.style.opacity = '1');
}

/**
 * Gather currently active filters (checkboxes, text, range, etc.)
 * Also incorporate "data-checkbox-logic" for AND vs OR logic.
 */
function getActiveFilters() {
  const filters = {};

  // 1) Read all checkboxes/radios
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
            if (!filters[cat]) filters[cat] = { type: 'text', values: [] };
            filters[cat].values.push(val);
          });
        }
      }
    }
  });

  // 2) Other inputs (text, select, date, range)
  const otherInputs = filterContainer.querySelectorAll(
    'input[custom-filter-field]:not([type="checkbox"]):not([type="radio"]), select[custom-filter-field], textarea[custom-filter-field]'
  );
  otherInputs.forEach(input => {
    const cats = input.getAttribute('custom-filter-field').split(',').map(c => c.trim());
    const val  = input.value.trim();
    cats.forEach(cat => {
      if (!filters[cat]) filters[cat] = { type: 'text', values: [] };

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

  // 3) "data-checkbox-logic": if container says "all", we do AND logic
  //    We assume each container with custom-filter-auto="category" can have data-checkbox-logic="all" or "any"
  document.querySelectorAll('[custom-filter-auto]').forEach(el => {
    const cat = el.getAttribute('custom-filter-auto');
    const logicAttr = el.getAttribute('data-checkbox-logic'); // "all" or "any"
    if (filters[cat] && logicAttr) {
      // We'll store filters[cat].logic = "AND" or "OR"
      if (logicAttr.toLowerCase() === 'all') filters[cat].logic = 'AND';
      else filters[cat].logic = 'OR'; // default
    }
  });

  // Clean out empty
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
 * Check if a single item matches all active filters
 */
function checkItemAgainstFilters(fields, filters) {
  for (const cat in filters) {
    const filter = filters[cat];
    const itemValues = fields[cat] || [];

    if (filter.type === 'text') {
      // "AND" vs "OR" logic for multiple values
      const logicMode = filter.logic || 'OR'; // default is "OR"
      const valuesArr = filter.values;

      if (valuesArr.length > 1) {
        if (logicMode === 'AND') {
          // Item must contain ALL selected values
          for (const val of valuesArr) {
            const found = itemValues.some(iv => iv.includes(val));
            if (!found) return false; 
          }
        } else {
          // OR logic
          let match = false;
          for (const val of valuesArr) {
            if (itemValues.some(iv => iv.includes(val))) {
              match = true;
              break;
            }
          }
          if (!match) return false;
        }
      } else if (valuesArr.length === 1) {
        // single value
        const searchTerm = valuesArr[0];
        const combined   = itemValues.join(' ');
        if (!combined.includes(searchTerm)) return false;
      }
      // if .values is empty, filter was removed or no checkboxes checked
    }
    else if (filter.type === 'date') {
      const itemVal = itemValues[0];
      if (!itemVal) return false;
      const itemDate = new Date(itemVal);
      if (filter.from && itemDate < filter.from) return false;
      if (filter.to   && itemDate > filter.to)   return false;
    }
    else if (filter.type === 'range') {
      const itemVal = parseFloat(itemValues[0]);
      if (isNaN(itemVal)) return false;
      if (!isNaN(filter.from) && itemVal < filter.from) return false;
      if (!isNaN(filter.to)   && itemVal > filter.to)   return false;
    }
  }
  return true; // passed all filters
}

/**
 * Active tags
 */
function updateActiveTags(filters) {
  const tagsWrapper = document.querySelector('[custom-filter-tags="wrapper"]');
  if (!tagsWrapper) return;

  // remove old
  tagsWrapper.querySelectorAll('[custom-filter-tag="active"]').forEach(tag => tag.remove());

  const template = tagsWrapper.querySelector('[custom-filter-tag="template"]');
  if (!template) return;

  for (const cat in filters) {
    const filter = filters[cat];
    if (filter.type === 'text') {
      // possibly multiple values
      filter.values.forEach(val => {
        const newTag = createTagElement(template, cat, val);
        tagsWrapper.appendChild(newTag);
      });
    } 
    else if (filter.type === 'date' || filter.type === 'range') {
      const fromVal = !isNaN(filter.from) ? filter.from : '';
      const toVal   = !isNaN(filter.to)   ? filter.to   : '';
      const displayText = `${cat}: ${fromVal || '...'} - ${toVal || '...'}`;
      const newTag = createTagElement(template, cat, displayText, true);
      tagsWrapper.appendChild(newTag);
    }
    else if (cat === '*') {
      // wildcard
      filter.values.forEach(val => {
        const newTag = createTagElement(template, cat, val);
        tagsWrapper.appendChild(newTag);
      });
    }
  }
}

function createTagElement(template, cat, val, isRangeOrDate = false) {
  const newTag = template.cloneNode(true);
  newTag.setAttribute('custom-filter-tag', 'active');
  newTag.style.display = '';

  const textEl = newTag.querySelector('[custom-filter-tag-text="true"]');
  if (textEl) textEl.textContent = val;

  const removeBtn = newTag.querySelector('[custom-filter-tag-remove="true"]');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      if (isRangeOrDate) removeFilterRangeOrDate(cat);
      else removeFilterValue(cat, val);
    });
  }
  return newTag;
}

/**
 * Remove a text-based filter (uncheck or clear)
 */
function removeFilterValue(category, value) {
  console.log('[DEBUG] removeFilterValue ->', category, value);

  // uncheck checkboxes/radios
  const checkboxes = filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  checkboxes.forEach(input => {
    if (input.checked) {
      const labelEl = input.closest('label');
      if (!labelEl) return;
      const spanEl = labelEl.querySelector(`[custom-filter-field*="${category}"]`);
      if (spanEl && spanEl.textContent.toLowerCase().trim() === value.toLowerCase()) {
        input.checked = false;
      }
    }
  });

  // clear text fields, selects
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

  applyFilters();
}

/**
 * Remove a range/date filter
 */
function removeFilterRangeOrDate(category) {
  console.log('[DEBUG] removeFilterRangeOrDate ->', category);

  const fromInput = filterContainer.querySelector(`[custom-filter-field*="${category}"][custom-filter-range="from"]`);
  const toInput   = filterContainer.querySelector(`[custom-filter-field*="${category}"][custom-filter-range="to"]`);
  if (fromInput) fromInput.value = '';
  if (toInput)   toInput.value   = '';

  // reset slider if present
  const sliderEls = filterContainer.querySelectorAll(`.my-range-slider[data-slider-category="${category}"]`);
  sliderEls.forEach(sliderEl => {
    if (sliderEl.noUiSlider) {
      const mode = sliderEl.getAttribute('data-slider-mode') || 'range';
      const { minVal, maxVal } = getMinMaxFromItems(category);
      if (mode === 'minonly') {
        sliderEl.noUiSlider.set([minVal]);
      } else {
        sliderEl.noUiSlider.set([minVal, maxVal]);
      }
    }
  });
  applyFilters();
}

/**
 * Reset all filters
 */
function resetAllFilters() {
  console.log('[DEBUG] resetAllFilters');

  // Uncheck all checkboxes/radios
  const checkboxes = filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  checkboxes.forEach(input => { input.checked = false; });

  // Clear all text, select, etc.
  const inputs = filterContainer.querySelectorAll(
    'input[custom-filter-field]:not([type="checkbox"]):not([type="radio"]), select[custom-filter-field], textarea[custom-filter-field]'
  );
  inputs.forEach(input => { input.value = ''; });

  // Reset sliders
  const sliderEls = filterContainer.querySelectorAll('.my-range-slider');
  sliderEls.forEach(sliderEl => {
    if (sliderEl.noUiSlider) {
      const category = sliderEl.getAttribute('data-slider-category');
      const mode     = sliderEl.getAttribute('data-slider-mode') || 'range';
      const { minVal, maxVal } = getMinMaxFromItems(category);
      if (mode === 'minonly') sliderEl.noUiSlider.set([minVal]);
      else sliderEl.noUiSlider.set([minVal, maxVal]);
    }
  });
}

/**
 * Clear a specific category
 */
function clearCategoryFilter(category) {
  console.log('[DEBUG] clearCategoryFilter ->', category);

  // uncheck checkboxes/radios
  const checkboxes = filterContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  checkboxes.forEach(input => {
    const labelEl = input.closest('label');
    if (!labelEl) return;
    const spanEl = labelEl.querySelector(`[custom-filter-field*="${category}"]`);
    if (spanEl) input.checked = false;
  });

  // clear text, select
  const inputs = filterContainer.querySelectorAll(
    `input[custom-filter-field*="${category}"]:not([type="checkbox"]):not([type="radio"]),
     select[custom-filter-field*="${category}"],
     textarea[custom-filter-field*="${category}"]`
  );
  inputs.forEach(input => { input.value = ''; });

  // reset slider
  const sliderEls = filterContainer.querySelectorAll(`.my-range-slider[data-slider-category="${category}"]`);
  sliderEls.forEach(sliderEl => {
    if (sliderEl.noUiSlider) {
      const mode = sliderEl.getAttribute('data-slider-mode') || 'range';
      const { minVal, maxVal } = getMinMaxFromItems(category);
      if (mode === 'minonly') sliderEl.noUiSlider.set([minVal]);
      else sliderEl.noUiSlider.set([minVal, maxVal]);
    }
  });

  applyFilters();
}

/** Utility: Capitalize a string */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}