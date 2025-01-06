# Filter System: Auto-Population + Range Sliders + AND/OR Checkbox Logic

This solution provides a **comprehensive filter system** for a Webflow-like or custom HTML environment. It **auto-populates** select menus, checkboxes, or radios based on **unique data values** in your item list, offers **range sliders** for numeric fields, and supports toggling between **“AND”** (match all) and **“OR”** (match any) logic for multi-checked categories. It can also **skip empty** data values to avoid generating blank filter options.

## Key Features

1. **Auto-Populating Filters**  
   - For each category (e.g. `"city"`, `"season"`), the script gathers **unique** values from your items.  
   - You can choose:
     - **Simple** approach (e.g., auto-populating a `<select>` or building checkboxes from scratch).  
     - **Template-based** approach, where you create a single, styled label + input inside `[data-auto-template-item]`, and the script **clones** it for each unique data value.

2. **Skipping Empty Values**  
   - If your data might contain blank strings (`""` or `" "`), the script automatically **omits** them from the filter UI, preventing confusing empty entries.

3. **Min-Only or Range Sliders**  
   - Use `.my-range-slider` with `data-slider-mode="range"` for **two-handle** or `data-slider-mode="minonly"` for a **single-handle** “at least X” slider.  
   - Tooltips are customizable via `data-tooltip="km"`, `data-tooltip="beds"`, etc.

4. **“AND” vs. “OR” Logic** for Checkboxes  
   - Normally, checking multiple boxes in the same category means “Show items matching **any** of these” (OR).  
   - By adding `data-checkbox-logic="all"` on the container (the element with `custom-filter-auto="yourCategory"`), it switches to **AND** mode—items must match **all** checked values.

5. **General Filtering**  
   - Each item has `[custom-filter-field="category"]` with text for that category. The script matches user-selected filters (checkboxes, select, text inputs, range sliders) against each item.  
   - Items that match all filters remain visible; others are hidden.  
   - A `[custom-filter-empty="true"]` element can display “No items found” if everything is filtered out.

6. **Active Tags & Removal**  
   - `[custom-filter-tags="wrapper"]` can display “active tags.” The script clones `[custom-filter-tag="template"]` for each active filter.  
   - Clicking a tag’s remove button unchecks or clears that filter, then re-applies.

---

## Getting Started

1. **Add Your Items**  
   - Place your repeatable items inside `[custom-filter="list"]`.  
   - Each item should have `[custom-filter-item]`.  
   - For every relevant field, add `[custom-filter-field="category"]`. For instance:
     ```html
     <div custom-filter-item>
       <div custom-filter-field="city">Lisbon</div>
       <div custom-filter-field="season">summer</div>
       <div custom-filter-field="beds">2</div>
     </div>
     ```

2. **Design Your Filters** in `[custom-filter="filters"]`.  
   - **Auto-Populated**:  
     - `custom-filter-auto="beds"` with `data-auto-type="checkbox"` or `"select"`.  
     - If using a **template-based** approach, place one hidden element (e.g., a label with `[data-auto-template-item]`) that the script will clone.  
   - **Sliders**:  
     - Add a container: `<div class="my-range-slider" data-slider-category="beds" data-slider-mode="range" data-tooltip="beds"></div>`  
     - Also add hidden inputs:  
       ```html
       <input type="hidden" custom-filter-field="beds" custom-filter-range="from">
       <input type="hidden" custom-filter-field="beds" custom-filter-range="to">
       ```

3. **Skipping Empty Values**  
   - No extra setup needed. By default, the code checks `if (!val.trim()) return;` and omits blank entries.

4. **"AND" Checkbox Logic**  
   - Add `data-checkbox-logic="all"` on the same container that has `custom-filter-auto="myCategory"` if you want items to match **all** checked values in that category.  
   - Omit or use `data-checkbox-logic="any"` (or none) for **OR** logic.

5. **Active Tag Wrapper**  
   - Add `[custom-filter-tags="wrapper"]` somewhere.  
   - Inside it, place one element `[custom-filter-tag="template"]` with a child `[custom-filter-tag-text="true"]` for the filter name and `[custom-filter-tag-remove="true"]` for a remove button. This gets cloned per active filter.

6. **Initialization**  
   - After your data is loaded (e.g., `wized.onData(() => { initializeFilters(); })`), call `initializeFilters()`.  
   - The script collects your items, populates filters, sets up sliders, and applies filters.

---

## Usage Notes & Tips

- **Multiple Categories**: Each item can have multiple `[custom-filter-field]` attributes if needed, or a single `[custom-filter-field="category1, category2"]`.  
- **Wildcards**: Use `[custom-filter-field="*"]` on a text input to search across **all** fields.  
- **Min-Only Sliders**: `'minonly'` mode sets the upper value to `Number.MAX_SAFE_INTEGER` internally.  
- **Performance**: The code re-checks each item on every input/change. For large datasets, consider debouncing or optimizing if needed.  
- **Empty State**: The `[custom-filter-empty="true"]` element is shown if no items remain visible.

---

## Example Markup

```html
<!-- Filters -->
<div custom-filter="filters">
  <!-- Auto-populate checkboxes for "season" (AND logic) -->
  <div custom-filter-auto="season" data-auto-type="checkbox" data-checkbox-logic="all">
    <!-- If using template: 
         <label style="display:none;" data-auto-template-item> ... </label>
    -->
  </div>

  <!-- A slider for "beds" (minonly) -->
  <div class="my-range-slider" data-slider-category="beds" data-slider-mode="minonly" data-tooltip="beds"></div>
  <input type="hidden" custom-filter-field="beds" custom-filter-range="from">
  <input type="hidden" custom-filter-field="beds" custom-filter-range="to">

  <!-- Clear buttons, active tags, etc. -->
  <button custom-filter-clear="all">Clear All</button>
  <div custom-filter-tags="wrapper">
    <div custom-filter-tag="template" style="display:none;">
      <span custom-filter-tag-text="true"></span>
      <button custom-filter-tag-remove="true">x</button>
    </div>
  </div>
</div>

<!-- Item List -->
<div custom-filter="list">
  <div custom-filter-item>
    <div custom-filter-field="season">summer</div>
    <div custom-filter-field="beds">2</div>
    <!-- ... -->
  </div>
  <!-- More items... -->
</div>

<!-- Totals -->
<div>Total Results: <span custom-filter-total="results"></span></div>
<div>Total Items: <span custom-filter-total="all"></span></div>

<!-- Empty state -->
<div custom-filter-empty="true" style="display:none;">No items found</div>
```

---

## Concluding Remarks

With this setup, you can:

- **Automatically generate** checkbox/radio options or `<option>` tags from your items, skipping any empty values.  
- **Use** single or double handle sliders for numeric fields (distance, price, etc.).  
- **Decide** if multiple checkboxes in the same category require **“any match”** (OR) or **“all match”** (AND).  
- **Easily** manage active tags and toggling filters.

This approach allows you to build a highly flexible, user-friendly filtering system for Webflow, Wized, or any custom HTML environment.