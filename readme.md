# Filter + Sorting Solution

A **comprehensive** JavaScript solution that supports:

1. **Wildcard Search** (`custom-filter-field="*"`) to search across all fields.  
2. **Min-Only or Range Sliders** (`data-slider-mode="minonly"` or `"range"`) with custom tooltips and naming.  
3. **Checkbox AND/OR** Logic (`data-checkbox-logic="all"` => AND, default => OR).  
4. **Unique ID** linking checkboxes to active tags, so removing a tag unchecks the correct box and removes Webflow’s `w--redirected-checked` class.  
5. **Clear All** (`custom-filter-clear="all"`) or clear single category.  
6. **Sorting** via a select with attribute `[custom-filter-sort="true"]`, allowing ascending or descending sorts of numeric or text fields.

## Table of Contents

1. [Basic Setup](#basic-setup)  
2. [Wildcard Search](#wildcard-search)  
3. [Checkbox AND/OR Logic](#checkbox-andor-logic)  
4. [Min-Only or Range Sliders](#min-only-or-range-sliders)  
5. [Sorting Implementation](#sorting-implementation)  
6. [Clear All & Clear Category](#clear-all--clear-category)  
7. [Active Tags & Removal](#active-tags--removal)  
8. [Advanced Notes](#advanced-notes)

---

## Basic Setup

Include the script:
```html
<script src="https://cdn.jsdelivr.net/gh/SimonKefas/custom-filter@latest/script.js"></script>
```

### HTML Structure

- **`[custom-filter="filters"]`**: A container holding all your filters (checkboxes, text inputs, slider, etc.), plus buttons like “Clear All.”  
- **`[custom-filter="list"]`**: A container holding your repeated items, each with `[custom-filter-item]`.  
- **`[custom-filter-field="category"]`**: On an element inside each item, containing text that belongs to a certain category (e.g., `"price"`, `"title"`, `"season"`).  

Example:

```html
<!-- Filters -->
<div custom-filter="filters">
  <!-- Example of a wildcard search input -->
  <input type="text" custom-filter-field="*" placeholder="Search all fields..." />

  <!-- Example checkbox container with auto-population -->
  <div custom-filter-auto="season" data-auto-type="checkbox"></div>

  <!-- Example slider (distance) -->
  <div class="my-range-slider"
       data-slider-category="distance"
       data-slider-mode="range"
       data-tooltip="km"
       data-slider-tagname="Distance">
  </div>
  <input type="hidden" custom-filter-field="distance" custom-filter-range="from" />
  <input type="hidden" custom-filter-field="distance" custom-filter-range="to" />

  <!-- Sorting select -->
  <select custom-filter-sort="true">
    <option value="">No Sorting</option>
    <option value="price-asc">Price (low to high)</option>
    <option value="price-desc">Price (high to low)</option>
    <option value="title-asc">Title (A-Z)</option>
    <option value="title-desc">Title (Z-A)</option>
  </select>

  <!-- Clear All button -->
  <button type="button" custom-filter-clear="all">Clear All</button>

  <!-- Active tags -->
  <div custom-filter-tags="wrapper">
    <div custom-filter-tag="template" style="display:none;">
      <span custom-filter-tag-text="true"></span>
      <button type="button" custom-filter-tag-remove="true">x</button>
    </div>
  </div>
</div>

<!-- Item list -->
<div custom-filter="list">
  <div custom-filter-item>
    <div custom-filter-field="season">summer</div>
    <div custom-filter-field="distance">200</div>
    <div custom-filter-field="price">99</div>
    <div custom-filter-field="title">Beach Tour</div>
  </div>
  <!-- more items... -->
</div>

<!-- Totals & empty state -->
<div>Total Results: <span custom-filter-total="results"></span></div>
<div>Total Items: <span custom-filter-total="all"></span></div>
<div custom-filter-empty="true" style="display:none;">No items found</div>
```

---

## Wildcard Search

- **`[custom-filter-field="*"]`** on an input/textarea/select means the user-typed text is used to search **all** fields in each item.  
- The script combines all text from every category into one big lowercase string, then checks if the typed text is included.  
- If you want multi-term searching, the script can interpret multiple spaced words as separate terms. This is easily customized.

---

## Checkbox AND/OR Logic

- By default, if the user checks multiple boxes in the same category, the item can match **any** of them (OR logic).  
- If you set `data-checkbox-logic="all"` on the container that has `[custom-filter-auto="category"]`, the item must match **all** selected values (AND logic).  
- Example:
  ```html
  <div
    custom-filter-auto="season"
    data-auto-type="checkbox"
    data-checkbox-logic="all"
  ></div>
  ```
  Items must have all selected seasons (e.g., if the item’s `season` field can hold multiple values like “summer, winter”).

---

## Min-Only or Range Sliders

- If you want a **single-handle** slider (like “min price”), set `data-slider-mode="minonly"`. The script sets the “to” internally to a large number (`Number.MAX_SAFE_INTEGER`), effectively meaning “≥ from value.”  
- If you want a **two-handle** slider, use `data-slider-mode="range"`. The user can pick both a minimum and maximum.  
- The script listens to slider changes, updates hidden inputs (`[custom-filter-field="price"][custom-filter-range="from"]`), etc., and re-filters items.

---

## Sorting Implementation

1. **Sorting Select**:  
   - Add a `<select custom-filter-sort="true">` with options like `"price-asc"`, `"price-desc"`, etc.  
   - Example:
     ```html
     <select custom-filter-sort="true">
       <option value="">No Sorting</option>
       <option value="price-asc">Price (low to high)</option>
       <option value="price-desc">Price (high to low)</option>
       <option value="title-asc">Title (A-Z)</option>
       <option value="title-desc">Title (Z-A)</option>
     </select>
     ```
2. **After Filtering**:  
   - The script obtains the user’s chosen sort (e.g. `"price-asc"`) and sorts only the **filtered** items.  
   - Numeric fields (like `price`) are sorted numerically if parseable; else we do a **string** compare.  
   - Then we **re-inject** the items in the DOM in the new order, ensuring they appear sorted on the page.

---

## Clear All & Clear Category

- **Clear All**: A button with `[custom-filter-clear="all"]` calls `resetAllFilters()`, unchecking all boxes, clearing all text, and resetting sliders.  
- **Clear a Category**: A button with `[custom-filter-clear="price"]` (for example) unchecks or clears only that category’s inputs.

---

## Active Tags & Removal

- The script uses `[custom-filter-tags="wrapper"]` to display the user’s **active filters** (like checkboxes, text searches, or range sliders).  
- A hidden template `[custom-filter-tag="template"]` is cloned for each active filter.  
- Removing a tag calls a function (like `removeFilterValue()`), which unchecks the corresponding input or slider range and re-applies filters.

### Linking Checkboxes

- Each **checkbox** is given a unique ID (`checkbox-[category]-[index]`).  
- The active tag for that checkbox stores the same ID. Removing the tag unchecks that exact box and removes the Webflow styling class (`w--redirected-checked`).

---

## Advanced Notes

- If you have **very large** item lists, consider more efficient re-rendering strategies or pagination. This script, by default, just hides or shows items in the DOM and reorders them on sorting.  
- If you want to **remember** the user’s filter/sort selection across pages, you can store them in the URL or localStorage and reapply on page load.  
- The solution is **highly customizable**: you can rename attributes, fields, logic, or the approach to sorting as needed.

---

### Conclusion

With this code + README:

- **Filtering** includes wildcard search, date/range logic, min-only sliders, checkbox AND/OR logic, etc.  
- **Sorting** is optional but easy to implement with `[custom-filter-sort="true"]` and some custom `<option value="field-asc/desc">` entries.  
- **Clearing** is done via `[custom-filter-clear="all"]` or `[custom-filter-clear="category"]`.  
- **Tags** show the user’s active filters and let them remove individually or all at once.
