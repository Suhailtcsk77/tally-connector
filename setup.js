const salesLedgersInput =
  document.getElementById('salesLedgers');

const salesVoucherTypesInput =
  document.getElementById('salesVoucherTypes');

const companyNameInput =
  document.getElementById(
    'companyName'
  );

const defaultProductUnitInput =
  document.getElementById('defaultProductUnit');

const defaultCustomerAreaInput =
  document.getElementById('defaultCustomerArea');

const syncCustomersToOrderFlowInput =
  document.getElementById('syncCustomersToOrderFlow');

const syncProductsToOrderFlowInput =
  document.getElementById('syncProductsToOrderFlow');

const pricingMethodRadios =
  document.querySelectorAll(
    'input[name="pricingMethod"]'
  );

const priceLevelSettings =
  document.getElementById('priceLevelSettings');

function updatePricingMethodVisibility() {
  const selected = document.querySelector(
    'input[name="pricingMethod"]:checked'
  )?.value;

  priceLevelSettings.style.display =
    selected === 'price_levels' ? 'block' : 'none';
}

pricingMethodRadios.forEach(radio => {
  radio.addEventListener(
    'change',
    updatePricingMethodVisibility
  );
});

updatePricingMethodVisibility();


const gstEnabledInput =
  document.getElementById(
    'gstEnabled'
  );


const commonCgstLedgersInput =
  document.getElementById('commonCgstLedgers');

const commonSgstLedgersInput =
  document.getElementById('commonSgstLedgers');

const commonIgstLedgersInput =
  document.getElementById('commonIgstLedgers');


const cgstLedgersContainer =
  document.getElementById(
    'cgstLedgers'
  );


const sgstLedgersContainer =
  document.getElementById(
    'sgstLedgers'
  );


const igstLedgersContainer =
  document.getElementById(
    'igstLedgers'
  );


const addCgstButton =
  document.getElementById(
    'addCgstButton'
  );


const addSgstButton =
  document.getElementById(
    'addSgstButton'
  );


const addIgstButton =
  document.getElementById(
    'addIgstButton'
  );

const saveButton =
  document.getElementById(
    'saveButton'
  );


const message =
  document.getElementById(
    'message'
  );

  function addLedgerRow(
  container,
  taxType
) {

  const row =
    document.createElement(
      'div'
    );

  row.className =
  'ledger-row';


  row.style.marginBottom =
    '10px';


  row.innerHTML = `

    <input
      type="number"
      class="${taxType}-rate"
      placeholder="Rate %"
      step="0.01"
    >

    <input
      type="text"
      class="${taxType}-ledger"
      placeholder="${taxType.toUpperCase()} Ledger Name"
    >

    <button
      type="button"
      class="remove-ledger"
    >
      Remove
    </button>

  `;


  const removeButton =
    row.querySelector(
      '.remove-ledger'
    );


  removeButton.addEventListener(

    'click',

    () => {

      row.remove();

    }

  );


  container.appendChild(
    row
  );

}

addCgstButton.addEventListener(

  'click',

  () => {

    addLedgerRow(

      cgstLedgersContainer,

      'cgst'

    );

  }

);


addSgstButton.addEventListener(

  'click',

  () => {

    addLedgerRow(

      sgstLedgersContainer,

      'sgst'

    );

  }

);


addIgstButton.addEventListener(

  'click',

  () => {

    addLedgerRow(

      igstLedgersContainer,

      'igst'

    );

  }

);

addLedgerRow(
  cgstLedgersContainer,
  'cgst'
);


addLedgerRow(
  sgstLedgersContainer,
  'sgst'
);


addLedgerRow(
  igstLedgersContainer,
  'igst'
);

function getLedgerMappings(
  taxType
) {

  const rates =
    document.querySelectorAll(
      `.${taxType}-rate`
    );


  const ledgers =
    document.querySelectorAll(
      `.${taxType}-ledger`
    );


  const mappings =
    [];


  for (
    let i = 0;
    i < rates.length;
    i++
  ) {

    const rate =
      Number(
        rates[i].value
      );


    const ledgerName =
      ledgers[i].value
        .trim();


    if (

      Number.isFinite(
        rate
      )

      &&

      rate >= 0

      &&

      ledgerName

    ) {

      mappings.push({

        rate,

        ledgerName

      });

    }

  }


  return mappings;

}


async function saveSetup() {


  const companyName =
    companyNameInput.value.trim();

  const salesLedgers = [
  ...new Set(
    salesLedgersInput.value
      .split(/\r?\n/)
      .map(name => name.trim())
      .filter(Boolean)
  )
];

const salesLedger = salesLedgers[0] || '';

  const salesVoucherTypes = [
  ...new Set(
    salesVoucherTypesInput.value
      .split(/\r?\n/)
      .map(name => name.trim())
      .filter(Boolean)
  )
];

const salesVoucherType =
  salesVoucherTypes[0] || '';


  const gstEnabled =
    gstEnabledInput.value ===
    'true';


const commonCgstLedgers = [
  ...new Set(
    commonCgstLedgersInput.value
      .split(/\r?\n/)
      .map(name => name.trim())
      .filter(Boolean)
  )
];

const commonSgstLedgers = [
  ...new Set(
    commonSgstLedgersInput.value
      .split(/\r?\n/)
      .map(name => name.trim())
      .filter(Boolean)
  )
];

const commonIgstLedgers = [
  ...new Set(
    commonIgstLedgersInput.value
      .split(/\r?\n/)
      .map(name => name.trim())
      .filter(Boolean)
  )
];

const commonCgstLedger =
  commonCgstLedgers[0] || '';

const commonSgstLedger =
  commonSgstLedgers[0] || '';

const commonIgstLedger =
  commonIgstLedgers[0] || '';


 

  const cgstLedgers =
  getLedgerMappings(
    'cgst'
  );


const sgstLedgers =
  getLedgerMappings(
    'sgst'
  );


const igstLedgers =
  getLedgerMappings(
    'igst'
  );

const roundOffLedger =
  document
    .getElementById(
      'roundOffLedger'
    )
    .value
    .trim();





  if (!companyName) {

    message.textContent =
      'Please enter Tally Company Name.';

    return;

  }





  saveButton.disabled =
    true;


  message.textContent =
    'Saving...';



  try {

  const result =
  await window.tallyBridge.saveSetup({

    companyName,
    defaultProductUnit:
  defaultProductUnitInput.value.trim(),

defaultCustomerArea:
  defaultCustomerAreaInput.value.trim(),
    syncCustomersToOrderFlow:
  syncCustomersToOrderFlowInput.checked,

syncProductsToOrderFlow:
  syncProductsToOrderFlowInput.checked,

    pricingMethod:
  document.querySelector(
    'input[name="pricingMethod"]:checked'
  )?.value || 'standard',

highestPriceLevel:
  document.getElementById('highestPriceLevel').value.trim(),

mediumPriceLevel:
  document.getElementById('mediumPriceLevel').value.trim(),

lowestPriceLevel:
  document.getElementById('lowestPriceLevel').value.trim(),

specialPriceLevel:
  document.getElementById('specialPriceLevel').value.trim(),

    salesLedgers,
    salesLedger,

    salesVoucherTypes,
    salesVoucherType,

    gstEnabled,

    cgstLedgers,
    sgstLedgers,
    igstLedgers,

    commonCgstLedgers,
commonCgstLedger,

commonSgstLedgers,
commonSgstLedger,

commonIgstLedgers,
commonIgstLedger,

    roundOffLedger

  });




    if (result.success) {

      message.textContent =
        'Setup completed successfully!';

      return;

    }



    message.textContent =
      result.error ||
      'Could not save setup.';


    saveButton.disabled =
      false;


  } catch (error) {


    console.error(error);


    message.textContent =
      'Something went wrong.';


    saveButton.disabled =
      false;

  }


}



saveButton.addEventListener(

  'click',

  saveSetup

);


const previewProductsButton =
  document.getElementById('previewProductsButton');

const previewCustomersButton =
  document.getElementById('previewCustomersButton');

const previewResults =
  document.getElementById('previewResults');

async function runTallyPreview(type) {
  const companyName = companyNameInput.value.trim();

  if (!companyName) {
    previewResults.style.display = 'block';
    previewResults.textContent =
      'Please enter the Tally Company Name first.';
    return;
  }

  previewProductsButton.disabled = true;
  previewCustomersButton.disabled = true;

  previewResults.style.display = 'block';
  previewResults.textContent =
    type === 'products'
      ? 'Fetching product preview from Tally...'
      : 'Fetching customer preview from Tally...';

  try {
    const previewData = {
  companyName,

  highestPriceLevel:
    document.getElementById('highestPriceLevel').value.trim(),

  defaultProductUnit:
    defaultProductUnitInput.value.trim(),

  defaultCustomerArea:
    defaultCustomerAreaInput.value.trim()
};

    const result =
      type === 'products'
        ? await window.tallyBridge.previewProducts(previewData)
        : await window.tallyBridge.previewCustomers(previewData);

    if (!result || !result.success) {
      throw new Error(
        result?.error || 'Tally preview failed.'
      );
    }

    previewResults.replaceChildren();

    const heading = document.createElement('h3');
    heading.textContent =
      type === 'products'
        ? 'Product Preview'
        : 'Customer Preview';

    previewResults.appendChild(heading);

    const summary = document.createElement('p');
    summary.className = 'preview-message';
    summary.textContent =
      `Showing ${result.rows.length} row(s), maximum 10. ` +
      'Preview only — no data was uploaded to Order Flow.';

    previewResults.appendChild(summary);

    if (!result.rows.length) {
      const emptyMessage = document.createElement('p');
      emptyMessage.textContent =
        'No matching records were returned by Tally.';
      previewResults.appendChild(emptyMessage);
      return;
    }

    const columns = Object.keys(result.rows[0]);
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    for (const column of columns) {
      const th = document.createElement('th');

      th.textContent = column
        .replace(/_/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());

      headerRow.appendChild(th);
    }

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    for (const row of result.rows) {
      const tr = document.createElement('tr');

      for (const column of columns) {
        const td = document.createElement('td');
        const value = row[column];

        td.textContent =
          value === null ||
          value === undefined ||
          value === ''
            ? '—'
            : String(value);

        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    previewResults.appendChild(table);

  } catch (error) {
    console.error('[TALLY PREVIEW ERROR]', error);

    previewResults.replaceChildren();

    const errorMessage = document.createElement('p');
    errorMessage.className = 'preview-message';
    errorMessage.textContent =
      `Preview failed: ${error.message}`;

    previewResults.appendChild(errorMessage);

  } finally {
    previewProductsButton.disabled = false;
    previewCustomersButton.disabled = false;
  }
}

previewProductsButton.addEventListener('click', () => {
  runTallyPreview('products');
});

previewCustomersButton.addEventListener('click', () => {
  runTallyPreview('customers');
});
