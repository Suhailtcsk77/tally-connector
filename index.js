// =================================
// TALLY BRIDGE
// INDEX.JS
// PART 1
// =================================


// =================================
// IMPORTS
// =================================

const fs =
  require(
    'fs'
  );


const path =
  require(
    'path'
  );


const SALES_LEDGER_CACHE_FILE =
  path.join(
    __dirname,
    'sales_ledger_cache.json'
  );


const os =
  require(
    'os'
  );


const axios =
  require(
    'axios'
  );

const { createClient } =
  require('@supabase/supabase-js');


const dotenv =
  require(
    'dotenv'
  );


const balancesFile =
  require('path').join(
    __dirname,
    'balances_cache.json'
  );


const stocksFile =
  require('path').join(
    __dirname,
    'stocks_cache.json'
  );


// =================================
// APPLICATION DATA DIRECTORY
// =================================

const appDataDirectory =
  path.join(

    process.env.APPDATA ||

    path.join(
      os.homedir(),
      'AppData',
      'Roaming'
    ),

    'Tally Bridge'

  );


// =================================
// CREATE DATA DIRECTORY
// =================================

if (

  !fs.existsSync(
    appDataDirectory
  )

) {

  fs.mkdirSync(

    appDataDirectory,

    {

      recursive:
        true

    }

  );

}


// =================================
// ENVIRONMENT FILE
// =================================

const envPath =
  path.join(

    appDataDirectory,

    '.env'

  );

  const customerSyncStateFile =
  path.join(
    appDataDirectory,
    'customer_sync_state.json'
  );


// =================================
// LOAD ENVIRONMENT
// =================================

dotenv.config({

  path:
    envPath

});


// =================================
// SHOW PATHS
// =================================

console.log('');

console.log(
  'Tally Bridge data folder:',
  appDataDirectory
);

console.log(
  'Environment file:',
  envPath
);

console.log('');


// =================================
// ENVIRONMENT VARIABLES
// =================================

const tallyUrl =
  process.env.TALLY_URL ||
  'http://127.0.0.1:9000';


const tallyBridgeUrl =
  process.env.TALLY_BRIDGE_URL;


const bridgeSecret =
  process.env.TALLY_BRIDGE_SECRET;

const tallyCompanyId =
  String(process.env.TALLY_COMPANY_ID || '').trim();


const defaultProductUnit =
  String(process.env.DEFAULT_PRODUCT_UNIT || '').trim() || 'Nos';

const defaultCustomerArea =
  String(process.env.DEFAULT_CUSTOMER_AREA || '').trim() || 'Shop';

const expectedTallyCompanyName =
  String(process.env.TALLY_COMPANY || '').trim();

// TEMPORARY: fetch customer data without writing it to Supabase.
const CUSTOMER_SYNC_PREVIEW_ONLY = false;

const syncCustomersToOrderFlowEnabled =
  String(
    process.env.SYNC_CUSTOMERS_TO_ORDER_FLOW || ''
  ).trim().toLowerCase() === 'true';


const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY;


const invoiceEdgeFunctionUrl =
  process.env.INVOICE_EDGE_FUNCTION_URL;


const edgeFunctionUrl =
  process.env.TALLY_BRIDGE_URL;

const supabaseUrl =
  process.env.SUPABASE_URL;


const supabaseKey =
  process.env.SUPABASE_ANON_KEY;

const pricingMethod =
  String(
    process.env.PRICING_METHOD || 'standard'
  ).trim().toLowerCase();

const priceLevelNames = {
  highest: String(
    process.env.PRICE_LEVEL_HIGHEST || ''
  ).trim(),

  medium: String(
    process.env.PRICE_LEVEL_MEDIUM || ''
  ).trim(),

  lowest: String(
    process.env.PRICE_LEVEL_LOWEST || ''
  ).trim(),

  special: String(
    process.env.PRICE_LEVEL_SPECIAL || ''
  ).trim()
};

// =================================
// TALLY GST CONFIGURATION
// =================================


const setupGstEnabled =
  String(
    process.env.GST_ENABLED || 'false'
  ).toLowerCase() === 'true';


const tallyCompanyGstEnabled =
  String(
    process.env.TALLY_COMPANY_GST ?? 'true'
  ).trim().toLowerCase() === 'true';

console.log(
  'Company GST flag from activation:',
  tallyCompanyGstEnabled
);



const cgstLedgers =
  parseLedgerConfig(
    process.env.CGST_LEDGERS
  );


const sgstLedgers =
  parseLedgerConfig(
    process.env.SGST_LEDGERS
  );


const igstLedgers =
  parseLedgerConfig(
    process.env.IGST_LEDGERS
  );

const roundOffLedger =
  process.env.ROUND_OFF_LEDGER || '';

const salesLedger =
  String(
    process.env.SALES_LEDGER || ''
  ).trim();

const salesVoucherType =
  String(
    process.env.SALES_VOUCHER_TYPE || ''
  ).trim();


const commonCgstLedger =
  String(
    process.env.COMMON_CGST_LEDGER || ''
  ).trim();


const commonSgstLedger =
  String(
    process.env.COMMON_SGST_LEDGER || ''
  ).trim();


const commonIgstLedger =
  String(
    process.env.COMMON_IGST_LEDGER || ''
  ).trim();


// =================================
// PARSE LEDGER CONFIGURATION
// =================================

function parseLedgerConfig(
  value
) {

  if (
    !value
  ) {

    return [];

  }


  try {

    const parsed =
      JSON.parse(
        value
      );


    return Array.isArray(
      parsed
    )
      ? parsed
      : [];

  } catch (error) {

    console.error(
      'Could not parse GST ledger configuration:',
      error.message
    );


    return [];

  }

}


// =================================
// SHOW GST CONFIGURATION
// =================================

console.log(
  'Setup GST Enabled:',
  setupGstEnabled
);

console.log(
  'CGST Ledgers:',
  cgstLedgers
);

console.log(
  'SGST Ledgers:',
  sgstLedgers
);

console.log(
  'IGST Ledgers:',
  igstLedgers
);

console.log(
  'Common CGST Ledger:',
  commonCgstLedger
);

console.log(
  'Common SGST Ledger:',
  commonSgstLedger
);

console.log(
  'Common IGST Ledger:',
  commonIgstLedger
);

if (
  !supabaseUrl
) {

  console.error(
    'ERROR: SUPABASE_URL is missing in .env'
  );

  process.exit(1);

}


if (!invoiceEdgeFunctionUrl) {

  console.error(
    'INVOICE_EDGE_FUNCTION_URL is missing from .env'
  );

}

const supabase =
  createClient(
    supabaseUrl,
    supabaseKey
  );

console.log('');
console.log('==========================================');
console.log('SUPABASE CONNECTION CHECK');
console.log('==========================================');

console.log(
  '[BRIDGE] Supabase URL:',
  supabaseUrl
);

console.log('==========================================');
console.log('');




// =================================
// SYNC INTERVAL
// =================================

const CHECK_INTERVAL =
  Number(

    process.env.CHECK_INTERVAL ||

    600000

  );


// =================================
// INVOICE PROCESSING STATE
// =================================

let invoiceProcessing =
  false;


// =================================
// CACHE FILES
// =================================

const balanceCacheFile =
  path.join(

    appDataDirectory,

    'balance-cache.json'

  );


const stockCacheFile =
  path.join(

    appDataDirectory,

    'stock-cache.json'

  );


const salesLedgerCacheFile =
  path.join(

    appDataDirectory,

    'sales-ledger-cache.json'

  );


// =================================
// VALIDATE CONFIGURATION
// =================================

function validateConfiguration() {

  const missing =
    [];


  if (
    !bridgeSecret
  ) {

    missing.push(
      'BRIDGE_SECRET'
    );

  }


  if (
    !invoiceEdgeFunctionUrl
  ) {

    missing.push(
      'INVOICE_EDGE_FUNCTION_URL'
    );

  }


  if (
    !supabaseAnonKey
  ) {

    missing.push(
      'SUPABASE_ANON_KEY'
    );

  }


  if (

    missing.length >
    0

  ) {

    console.error('');

    console.error(
      '=========================================='
    );

    console.error(
      'TALLY BRIDGE CONFIGURATION ERROR'
    );

    console.error(
      '=========================================='
    );

    console.error(
      'Missing environment variables:'
    );

    console.error(
      missing.join(
        ', '
      )
    );

    console.error(
      '=========================================='
    );

    console.error('');

    process.exit(
      1
    );

  }

}


// =================================
// NORMALIZE NAME
// =================================

function normalizeName(
  value
) {

  return String(

    value ||

    ''

  )

    .trim()

    .replace(
      /\s+/g,
      ' '
    )

    .toLowerCase();

}


// =================================
// DECODE XML
// =================================

function decodeXml(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';

  }


  return String(
    value
  )

    .replace(
      /&amp;/g,
      '&'
    )

    .replace(
      /&apos;/g,
      "'"
    )

    .replace(
      /&quot;/g,
      '"'
    )

    .replace(
      /&lt;/g,
      '<'
    )

    .replace(
      /&gt;/g,
      '>'
    )

    .replace(
      /&#(\d+);/g,

      (
        match,
        code
      ) =>

        String.fromCharCode(
          Number(code)
        )

    )

    .trim();

}


// =================================
// ESCAPE XML
// =================================

function escapeXml(
  value
) {

  return String(

    value ??

    ''

  )

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&apos;'
    );

}


// =================================
// GET XML TAG VALUE
// =================================

function getTagValue(

  xml,

  tagName

) {

  if (
    !xml ||
    !tagName
  ) {

    return null;

  }


  const regex =
    new RegExp(

      `<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`,

      'i'

    );


  const match =
    String(
      xml
    ).match(
      regex
    );


  if (
    !match
  ) {

    return null;

  }


  const value =
    match[1]

      .replace(
        /<[^>]+>/g,
        ''
      )

      .trim();


  return decodeXml(
    value
  );

}


// =================================
// POST XML TO TALLY
// =================================

async function postToTally(

  xml,

  timeout =
    30000

) {

  try {

    const response =
      await axios.post(

        tallyUrl,

        xml,

        {

          headers: {

            'Content-Type':
              'text/xml'

          },

          timeout:
            timeout

        }

      );


    return {

      success:
        true,

      data:
        response.data

    };


  } catch (
  error
  ) {

    console.error('');

    console.error(
      '=========================================='
    );

    console.error(
      'TALLY CONNECTION ERROR'
    );

    console.error(
      '=========================================='
    );


    if (
      error.response
    ) {

      console.error(
        'Status:',
        error.response.status
      );

      console.error(
        'Response:',
        error.response.data
      );

    } else {

      console.error(
        error.message
      );

    }


    console.error(
      '=========================================='
    );

    console.error('');


    return {

      success:
        false,

      data:
        null

    };

  }

}


async function postToTally(xml, timeout = 30000) {
  try {
    const response = await axios.post(
      tallyUrl,
      xml,
      {
        headers: {
          'Content-Type': 'text/xml'
        },
        timeout
      }
    );

    return {
      success: true,
      data: response.data
    };

  } catch (error) {
    const code = error.code || 'UNKNOWN';
    const httpStatus = error.response?.status ?? null;

    let diagnosis;

    if (httpStatus !== null) {
      diagnosis =
        `Tally returned HTTP ${httpStatus}. ` +
        'Check the Tally service and the request.';
    } else {
      switch (code) {
        case 'ECONNREFUSED':
          diagnosis =
            'Tally refused the connection. ' +
            'Check that Tally is open and its HTTP service ' +
            'is available at the configured host and port.';
          break;

        case 'ECONNABORTED':
        case 'ETIMEDOUT':
          diagnosis =
            `Tally did not respond within ${timeout} ms. ` +
            'Check Tally, the company loading status, and the connection.';
          break;

        case 'ENOTFOUND':
          diagnosis =
            'The configured Tally hostname could not be found. ' +
            'Check the host configuration.';
          break;

        case 'ECONNRESET':
          diagnosis =
            'The connection was unexpectedly closed. ' +
            'Check whether Tally is running or restarting.';
          break;

        case 'EHOSTUNREACH':
          diagnosis =
            'The Tally computer cannot be reached. ' +
            'Check the network and host address.';
          break;

        default:
          diagnosis =
            'Unexpected Tally connection error. ' +
            'Check the error message and operating-system error code.';
      }
    }

    const details = {
      timestamp: new Date().toISOString(),
      stage: 'Tally XML request',
      errorCode: code,
      httpStatus,
      timeoutMs: timeout,
      message: String(error.message || 'Unknown error'),
      diagnosis
    };

    console.error(
      '[DIAGNOSTIC ERROR] ' + JSON.stringify(details)
    );

    return {
      success: false,
      data: null
    };
  }
}




async function writeProductThroughEdgeFunction(product, existingId) {
  const productName =
    product.product_name ||
    product.name ||
    '(name unavailable)';

  try {
    if (existingId !== null && existingId !== undefined) {
      product.updated_at = getIndiaLocalTimestamp();
    }

    const functionUrl =
      `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/tally-bridge-products`;

    const response = await axios.post(
      functionUrl,
      {
        bridge_secret: bridgeSecret,
        product,
        existing_id: existingId ?? null
      },
      {
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        },
        timeout: 30000
      }
    );

    if (
      !response.data ||
      response.data.success !== true ||
      !response.data.product ||
      !['inserted', 'updated'].includes(response.data.action)
    ) {
      throw new Error(
        response.data?.error ||
        'The server returned an invalid product-sync response.'
      );
    }

    return {
      action: response.data.action,
      product: response.data.product
    };

  } catch (error) {
    const status = error.response?.status ?? null;
    const code = error.code || 'UNKNOWN';

    let diagnosis;

    if (status === 401 || status === 403) {
      diagnosis =
        'Authentication or permission failure. ' +
        'Check bridge activation and server permissions.';
    } else if (status === 400 || status === 422) {
      diagnosis =
        'The server rejected the product data. ' +
        'Check required fields and database validation.';
    } else if (status === 404) {
      diagnosis =
        'The Edge Function endpoint was not found. ' +
        'Check the Supabase URL and deployed function.';
    } else if (status === 429) {
      diagnosis =
        'Too many requests. Wait before retrying.';
    } else if (status !== null && status >= 500) {
      diagnosis =
        'Supabase server error. Check the Edge Function logs.';
    } else if (
      ['ECONNABORTED', 'ETIMEDOUT'].includes(code)
    ) {
      diagnosis =
        'The request timed out. Check the network and Supabase response.';
    } else if (
      ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET'].includes(code)
    ) {
      diagnosis =
        'Could not reach Supabase. Check internet access and endpoint settings.';
    } else {
      diagnosis =
        'Unexpected product-write failure. Inspect the error message and code.';
    }

    const serverMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Unknown error';

    const details = {
      timestamp: new Date().toISOString(),
      stage: 'Supabase product write',
      productName: String(productName).slice(0, 150),
      existingId: existingId ?? null,
      errorCode: code,
      httpStatus: status,
      diagnosis,
      message: String(serverMessage).slice(0, 1000)
    };

    console.error(
      '[DIAGNOSTIC ERROR] ' + JSON.stringify(details)
    );

    throw new Error(
      `Supabase product write failed: ${diagnosis} ` +
      `Status: ${status ?? 'not received'}. ` +
      `Code: ${code}. Details: ${String(serverMessage).slice(0, 300)}`
    );
  }
}


// =================================
// LOAD JSON CACHE
// =================================

function loadJsonFile(
  filePath
) {

  try {

    if (

      !fs.existsSync(
        filePath
      )

    ) {

      return {};

    }


    const content =
      fs.readFileSync(

        filePath,

        'utf8'

      );


    if (
      !content
    ) {

      return {};

    }


    return JSON.parse(
      content
    );


  } catch (
  error
  ) {

    console.error(

      'Could not read cache:',

      filePath

    );


    return {};

  }

}


// =================================
// SAVE JSON CACHE
// =================================

function saveJsonFile(

  filePath,

  data

) {

  try {

    fs.writeFileSync(

      filePath,

      JSON.stringify(

        data,

        null,

        2

      ),

      'utf8'

    );


    return true;


  } catch (
  error
  ) {

    console.error(

      'Could not save cache:',

      filePath

    );


    console.error(
      error.message
    );


    return false;

  }

}

// ========================================
// MANUAL PRODUCT SYNC
// ========================================

function getStockNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const match = String(value)
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/);

  if (!match) return null;

  const number = Number(match[0]);

  return Number.isFinite(number) ? number : null;
}



function getTallyMrp(itemXml) {
  const now = new Date();

  const todayKey =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');

  const detailRegex =
    /<MRPDETAILS\.LIST\b[^>]*>([\s\S]*?)<\/MRPDETAILS\.LIST>/gi;

  const applicableDetails = [];
  let detailMatch;

  while ((detailMatch = detailRegex.exec(itemXml)) !== null) {
    const detailXml = detailMatch[1];

    const rawDate = String(
      getTagValue(detailXml, 'FROMDATE') || ''
    ).replace(/\D/g, '');

    // Ignore MRP rates that are effective only in the future.
    if (rawDate && rawDate > todayKey) {
      continue;
    }

    const rates = [];

    const rateRegex =
      /<MRPRATEDETAILS\.LIST\b[^>]*>([\s\S]*?)<\/MRPRATEDETAILS\.LIST>/gi;

    let rateMatch;

    while ((rateMatch = rateRegex.exec(detailXml)) !== null) {
      const rateXml = rateMatch[1];

      const mrp = getStockNumber(
        getTagValue(rateXml, 'MRPRATE')
      );

      if (mrp === null) {
        continue;
      }

      const state = String(
        getTagValue(rateXml, 'STATENAME') || ''
      ).trim().toLowerCase();

      rates.push({ mrp, state });
    }

    if (rates.length > 0) {
      applicableDetails.push({
        date: rawDate || '00000000',
        rates
      });
    }
  }

  if (applicableDetails.length === 0) {
    return null;
  }

  // Use the latest MRP details that are currently applicable.
  applicableDetails.sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const latestRates = applicableDetails[0].rates;

  // Prefer a general "Any" state rate when Tally provides one.
  const anyStateRate = latestRates.find(rate =>
    rate.state.includes('any')
  );

  return anyStateRate
    ? anyStateRate.mrp
    : latestRates[0].mrp;
}

function getIndiaLocalTimestamp() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );

  return (
    `${values.year}-${values.month}-${values.day} ` +
    `${values.hour}:${values.minute}:${values.second}.` +
    `${String(now.getMilliseconds()).padStart(3, '0')}`
  );
}

function getTallyDateKey(value) {
  const text = String(value ?? '').trim();
  const digits = text.replace(/\D/g, '');

  let year;
  let month;
  let day;

  if (digits.length === 8) {
    // Tally dates may be YYYYMMDD or DDMMYYYY.
    if (/^(19|20|21)\d{2}/.test(digits)) {
      year = Number(digits.slice(0, 4));
      month = Number(digits.slice(4, 6));
      day = Number(digits.slice(6, 8));
    } else {
      day = Number(digits.slice(0, 2));
      month = Number(digits.slice(2, 4));
      year = Number(digits.slice(4, 8));
    }

    const checkDate = new Date(year, month - 1, day);

    if (
      checkDate.getFullYear() !== year ||
      checkDate.getMonth() !== month - 1 ||
      checkDate.getDate() !== day
    ) {
      return null;
    }
  } else {
    // Also support readable dates, if Tally returns them.
    const parsedDate = Date.parse(text);

    if (!Number.isFinite(parsedDate)) {
      return null;
    }

    const date = new Date(parsedDate);

    year = date.getFullYear();
    month = date.getMonth() + 1;
    day = date.getDate();
  }

  return (
    String(year) +
    String(month).padStart(2, '0') +
    String(day).padStart(2, '0')
  );
}


function getLatestApplicableStandardCost(itemXml) {
  if (!itemXml) {
    return null;
  }

  const now = new Date();

  const todayKey = getTallyDateKey(
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  );

  const costRegex =
    /<STANDARDCOSTLIST\.LIST\b[^>]*>[\s\S]*?<\/STANDARDCOSTLIST\.LIST>/gi;

  let latestDateKey = null;
  let latestRate = null;
  let match;

  while ((match = costRegex.exec(itemXml)) !== null) {
    const costXml = match[0];

    const applicableDate = getTagValue(
      costXml,
      'DATE'
    );

    const dateKey = getTallyDateKey(applicableDate);

    if (!dateKey || dateKey > todayKey) {
      continue;
    }

    const rateText = getTagValue(
      costXml,
      'RATE'
    );

    const rate = getStockNumber(rateText);

    if (rate === null) {
      continue;
    }

    if (
      latestDateKey === null ||
      dateKey > latestDateKey
    ) {
      latestDateKey = dateKey;
      latestRate = rate;
    }
  }

  return latestRate;
}

function getLatestApplicableSellingRate(itemXml) {
  const today = new Date();

  const todayKey =
    String(today.getFullYear()) +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');

  const regex =
    /<STANDARDPRICELIST\.LIST\b[^>]*>[\s\S]*?<\/STANDARDPRICELIST\.LIST>/gi;

  let latestDate = null;
  let latestRate = null;
  let match;

  while ((match = regex.exec(itemXml || '')) !== null) {
    const block = match[0];

    const date = getTallyDateKey(
      getTagValue(block, 'DATE')
    );

    const rate = getStockNumber(
      getTagValue(block, 'RATE')
    );

    if (!date || date > todayKey || rate === null) {
      continue;
    }

    if (latestDate === null || date > latestDate) {
      latestDate = date;
      latestRate = rate;
    }
  }

  return latestRate;
}


function getOpeningRate(itemXml) {
  return getStockNumber(
    getTagValue(itemXml, 'OPENINGRATE')
  );
}


function getLatestPriceLevelRate(
  itemXml,
  configuredPriceLevel
) {
  const wanted =
    normalizeProductName(configuredPriceLevel);

  if (!wanted) {
    return null;
  }

  const today = new Date();

  const todayKey =
    String(today.getFullYear()) +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');

  const listRegex =
    /<FULLPRICELIST\.LIST\b[^>]*>[\s\S]*?<\/FULLPRICELIST\.LIST>/gi;

  let latestDate = null;
  let latestNetPrice = null;
  let listMatch;

  while ((listMatch = listRegex.exec(itemXml || '')) !== null) {
    const listXml = listMatch[0];

    const level = normalizeProductName(
      getTagValue(listXml, 'PRICELEVEL') || ''
    );

    const date = getTallyDateKey(
      getTagValue(listXml, 'DATE')
    );

    if (level !== wanted || !date || date > todayKey) {
      continue;
    }

    const tierRegex =
      /<PRICELEVELLIST\.LIST\b[^>]*>[\s\S]*?<\/PRICELEVELLIST\.LIST>/gi;

    let tierMatch;
    let highestRate = null;
    let highestNet = null;

    while ((tierMatch = tierRegex.exec(listXml)) !== null) {
      const tierXml = tierMatch[0];

      const rate = getStockNumber(
        getTagValue(tierXml, 'RATE')
      );

      if (rate === null) {
        continue;
      }

      const discountRaw = getTagValue(
        tierXml,
        'DISCOUNT'
      );

      const discountMatch =
        String(discountRaw ?? '').match(/-?\d+(?:\.\d+)?/);

      const discount = discountMatch
        ? Number(discountMatch[0])
        : 0;

      const netPrice =
        rate * (1 - discount / 100);

      // Choose the highest rate tier, then apply its discount.
      if (highestRate === null || rate > highestRate) {
        highestRate = rate;
        highestNet = netPrice;
      }
    }

    if (
      highestNet !== null &&
      (latestDate === null || date > latestDate)
    ) {
      latestDate = date;
      latestNetPrice = highestNet;
    }
  }

  return latestNetPrice;
}


function getSelectedSellingPrice(
  itemXml,
  method,
  names
) {
  if (method === 'standard') {
    const standardPrice =
      getLatestApplicableSellingRate(itemXml);

    return standardPrice ?? getOpeningRate(itemXml);
  }

  if (method === 'opening') {
    const openingPrice = getOpeningRate(itemXml);

    return openingPrice ?? getLatestApplicableSellingRate(itemXml);
  }

  if (method === 'price_levels') {
    const fallbackPrice =
      getLatestApplicableSellingRate(itemXml) ??
      getOpeningRate(itemXml);

    const getConfiguredLevelPrice = (levelName) => {
      if (!normalizeProductName(levelName)) {
        return null;
      }

      return (
        getLatestPriceLevelRate(itemXml, levelName) ??
        fallbackPrice
      );
    };

    return {
      highest: getConfiguredLevelPrice(names.highest),
      medium: getConfiguredLevelPrice(names.medium),
      lowest: getConfiguredLevelPrice(names.lowest),
      special: getConfiguredLevelPrice(names.special)
    };
  }

  return null;
}

function removeTallyDefaultValues(product) {
  const commonTallyDefaults = [
  'not applicable',
  'not set',
  'none',
  'nil',
  'default',
  'not defined',
  'not available'
];

const defaultTextValues = {
  category: [
    'primary',
    ...commonTallyDefaults
  ],

  brand: commonTallyDefaults,

  product_code: commonTallyDefaults,

  details: commonTallyDefaults,

  alternative_unit: commonTallyDefaults,

  pachaging_unit: commonTallyDefaults
};

  for (const [field, defaults] of Object.entries(
    defaultTextValues
  )) {
    if (!Object.prototype.hasOwnProperty.call(product, field)) {
      continue;
    }

    const rawValue = product[field];

    if (rawValue === null || rawValue === undefined) {
      delete product[field];
      continue;
    }

    // Remove Tally's leading control characters and spaces.
    const cleanedValue = String(rawValue)
      .replace(/^[\u0000-\u001F\u007F]+/, '')
      .trim();

    if (
      !cleanedValue ||
      defaults.includes(cleanedValue.toLowerCase())
    ) {
      delete product[field];
    } else {
      product[field] = cleanedValue;
    }
  }

  // Tally commonly uses quantity 1 as the default.
  if (
    Object.prototype.hasOwnProperty.call(
      product,
      'alternative_quantity'
    ) &&
    Number(product.alternative_quantity) === 1
  ) {
    delete product.alternative_quantity;
  }

  return product;
}
// ========================================
// GET EXISTING PRODUCTS FROM SUPABASE
// ========================================

async function getSupabaseProducts(companyId) {
  const allRows = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
  .from('products')
  .select('id, company_id, tally_guid, product_name, product_code')
  .eq('company_id', companyId)
  .or('deleted.is.null,deleted.eq.false')
  .order('id', { ascending: true })
  .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(
        'Could not read existing products: ' + error.message
      );
    }

    allRows.push(...(data || []));

    if (!data || data.length < pageSize) break;

    offset += pageSize;
  }

  return allRows;
}


// ========================================
// NORMALIZE PRODUCT NAME
// ========================================

function normalizeProductName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function parseProductSyncGstRate(masterXml) {
  if (!masterXml) {
    return null;
  }

  const rateDetailRegex =
    /<RATEDETAILS\.LIST\b[^>]*>[\s\S]*?<\/RATEDETAILS\.LIST>/gi;

  let igstRate = null;
  let cgstRate = null;
  let sgstRate = null;

  let match;

  while (
    (match = rateDetailRegex.exec(masterXml)) !== null
  ) {
    const rateXml = match[0];

    const dutyHead = String(
      getTagValue(rateXml, 'GSTRATEDUTYHEAD') || ''
    ).trim().toLowerCase();

    const rateText = String(
      getTagValue(rateXml, 'GSTRATE') ?? ''
    ).trim();

    const rateMatch = rateText.match(/-?\d+(?:\.\d+)?/);

    if (!rateMatch) {
      continue;
    }

    const rate = Number(rateMatch[0]);

    if (!Number.isFinite(rate)) {
      continue;
    }

    if (
      dutyHead.includes('igst') ||
      dutyHead.includes('integrated tax')
    ) {
      igstRate = rate;
    } else if (
      dutyHead.includes('cgst') ||
      dutyHead.includes('central tax')
    ) {
      cgstRate = rate;
    } else if (
      dutyHead.includes('sgst') ||
      dutyHead.includes('state tax') ||
      dutyHead === 'utgst'
    ) {
      sgstRate = rate;
    }
  }

  if (igstRate !== null) {
    return igstRate;
  }

  if (cgstRate !== null || sgstRate !== null) {
    return (cgstRate ?? 0) + (sgstRate ?? 0);
  }

  return null;
}


async function getProductSyncStockGroupGstRates() {
  const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>EXPORT</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>TallyBridgeGSTStockGroups</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="TallyBridgeGSTStockGroups">
            <TYPE>StockGroup</TYPE>
            <FETCH>Name</FETCH>
            <FETCH>GUID</FETCH>
            <FETCH>ISDELETED</FETCH>
            <FETCH>Parent</FETCH>
            <FETCH>GSTDETAILS.LIST</FETCH>
            <FETCH>GSTRATEDETAILS.LIST</FETCH>
            <FETCH>GSTRATEDUTYHEAD</FETCH>
            <FETCH>GSTRATE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  const response = await postToTally(xml);

  if (
    !response ||
    !response.success ||
    !response.data
  ) {
    throw new Error(
      'Could not fetch stock-group GST rates from Tally.'
    );
  }

  const responseXml = String(response.data);

  console.log(
  '[GUID RAW CHECK] First STOCKITEM tag:',
  responseXml.match(/<STOCKITEM\b[^>]*>/i)?.[0] || 'NO STOCKITEM TAG'
);

console.log(
  '[GUID RAW CHECK] GUID element present:',
  /<GUID(?:\s[^>]*)?>[\s\S]*?<\/GUID>/i.test(responseXml)
);

console.log(
  '[GUID RAW CHECK] GUID attribute present:',
  /<STOCKITEM\b[^>]*\bGUID\s*=/i.test(responseXml)
);

  const tallyError = getTagValue(
    responseXml,
    'LINEERROR'
  );

  if (tallyError) {
    throw new Error(
      'Tally stock-group GST error: ' + tallyError
    );
  }

  const groups = new Map();

  const groupRegex =
    /<STOCKGROUP\b[^>]*>[\s\S]*?<\/STOCKGROUP>/gi;

  let match;

  while (
    (match = groupRegex.exec(responseXml)) !== null
  ) {
    const groupXml = match[0];

    const nameAttribute = groupXml.match(
      /<STOCKGROUP\b[^>]*\bNAME="([^"]*)"/i
    );

    const name = decodeXml(
      nameAttribute
        ? nameAttribute[1]
        : getTagValue(groupXml, 'NAME') || ''
    ).trim();

    if (!name) {
      continue;
    }

    const parent = decodeXml(
      getTagValue(groupXml, 'PARENT') || ''
    ).trim();

    groups.set(normalizeProductName(name), {
      parent,
      rate: parseProductSyncGstRate(groupXml)
    });
  }

  return groups;
}


function resolveProductSyncStockGroupGstRate(
  parentGroupName,
  stockGroupGstRates
) {
  let currentGroup = normalizeProductName(
    parentGroupName
  );

  const visited = new Set();

  while (
    currentGroup &&
    !visited.has(currentGroup)
  ) {
    visited.add(currentGroup);

    const group = stockGroupGstRates.get(currentGroup);

    if (!group) {
      return null;
    }

    if (group.rate !== null) {
      return group.rate;
    }

    currentGroup = normalizeProductName(
      group.parent
    );
  }

  return null;
}


// ========================================
// INDEX EXISTING PRODUCTS BY NAME
// ========================================

function indexExistingProducts(rows) {
  const byName = new Map();
  const byGuid = new Map();

  for (const row of rows) {
    const name = normalizeProductName(
      row.product_name
    );

    if (name) {
      if (!byName.has(name)) {
        byName.set(name, []);
      }

      byName.get(name).push(row);
    }

    const guid = String(
      row.tally_guid || ''
    ).trim().toLowerCase();

    if (guid && !byGuid.has(guid)) {
      byGuid.set(guid, row);
    }
  }

  return {
    byName,
    byGuid
  };
}


function parseProductSyncGstRate(masterXml) {
  if (!masterXml) {
    return null;
  }

  const rateDetailRegex =
    /<RATEDETAILS\.LIST\b[^>]*>[\s\S]*?<\/RATEDETAILS\.LIST>/gi;

  let igstRate = null;
  let cgstRate = null;
  let sgstRate = null;

  let match;

  while ((match = rateDetailRegex.exec(masterXml)) !== null) {
    const rateXml = match[0];

    const dutyHead = String(
      getTagValue(rateXml, 'GSTRATEDUTYHEAD') || ''
    ).trim().toLowerCase();

    const rateText = getTagValue(rateXml, 'GSTRATE');

    if (rateText === null || String(rateText).trim() === '') {
      continue;
    }

    const rate = Number(String(rateText).trim());

    if (!Number.isFinite(rate)) {
      continue;
    }

    if (
      dutyHead.includes('igst') ||
      dutyHead.includes('integrated')
    ) {
      igstRate = rate;
    } else if (
      dutyHead.includes('cgst') ||
      dutyHead.includes('central')
    ) {
      cgstRate = rate;
    } else if (
      dutyHead.includes('sgst') ||
      dutyHead.includes('state') ||
      dutyHead.includes('utgst')
    ) {
      sgstRate = rate;
    }
  }

  if (igstRate !== null) {
    return igstRate;
  }

  if (cgstRate !== null && sgstRate !== null) {
    return cgstRate + sgstRate;
  }

  return null;
}


async function getProductSyncStockGroupGstRates() {
  const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>EXPORT</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>TallyBridgeGSTStockGroups</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="TallyBridgeGSTStockGroups" ISINITIALIZE="Yes">
            <TYPE>Stock Group</TYPE>
            <NATIVEMETHOD>Parent</NATIVEMETHOD>
            <NATIVEMETHOD>GSTDetails</NATIVEMETHOD>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  const response = await postToTally(xml);

  if (!response || !response.success || !response.data) {
    throw new Error(
      'Could not fetch stock groups from Tally.'
    );
  }

  const responseXml = String(response.data);
  const tallyError = getTagValue(responseXml, 'LINEERROR');

  if (tallyError) {
    throw new Error(
      'Tally stock-group error: ' + tallyError
    );
  }

  const groups = new Map();
  const groupRegex =
    /<STOCKGROUP\b[^>]*>[\s\S]*?<\/STOCKGROUP>/gi;

  let match;

  while ((match = groupRegex.exec(responseXml)) !== null) {
    const groupXml = match[0];

    const nameMatch = groupXml.match(
      /<STOCKGROUP\b[^>]*\bNAME="([^"]*)"/i
    );

    const name = decodeXml(
      nameMatch
        ? nameMatch[1]
        : getTagValue(groupXml, 'NAME') || ''
    ).trim();

    if (!name) {
      continue;
    }

    groups.set(normalizeProductName(name), {
      parent: decodeXml(
        getTagValue(groupXml, 'PARENT') || ''
      ).trim(),
      rate: parseProductSyncGstRate(groupXml)
    });
  }

  return groups;
}


function resolveProductSyncStockGroupGstRate(
  parentGroupName,
  stockGroupGstRates
) {
  let currentGroup =
    normalizeProductName(parentGroupName);

  const visited = new Set();

  while (currentGroup && !visited.has(currentGroup)) {
    visited.add(currentGroup);

    const group = stockGroupGstRates.get(currentGroup);

    if (!group) {
      return null;
    }

    if (group.rate !== null) {
      return group.rate;
    }

    currentGroup = normalizeProductName(group.parent);
  }

  return null;
}



// ========================================
// MANUAL PRODUCT SYNC
// ========================================

async function syncProductsToSupabase() {
  if (!tallyCompanyId) {
    throw new Error(
      'Company ID is missing. Check your .env file.'
    );
  }

  await assertActiveCompanyMatchesEnv();

  console.log('[PRODUCT SYNC] Fetching stock items from Tally...');


const gstFetchFields = tallyCompanyGstEnabled
  ? ''
  : `
            <FETCH>GSTAPPLICABLE</FETCH>
            <FETCH>GSTDETAILS.LIST</FETCH>
            <FETCH>GSTRATEDETAILS.LIST</FETCH>
            <FETCH>GSTRATEDUTYHEAD</FETCH>
            <FETCH>GSTRATE</FETCH>
            <FETCH>SRCOFGSTDETAILS</FETCH>
`;


  const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>EXPORT</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>TallyBridgeStockItems</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="TallyBridgeStockItems">
            <TYPE>StockItem</TYPE>
            <NATIVEMETHOD>GUID</NATIVEMETHOD>
            <FETCH>Name</FETCH>
            <FETCH>GUID</FETCH>
            <FETCH>Parent</FETCH>
            <FETCH>BaseUnits</FETCH>
            <FETCH>PartNo</FETCH>
            <FETCH>Description</FETCH>
            <FETCH>StandardCostList</FETCH>
            <FETCH>StandardPriceList</FETCH>
            <FETCH>OpeningRate</FETCH>
            <FETCH>FullPriceList</FETCH>
            ${gstFetchFields}
            <FETCH>Category</FETCH>
            <FETCH>AdditionalUnits</FETCH>
            <FETCH>Conversion</FETCH>
            <FETCH>Denominator</FETCH>
            <FETCH>MRPDetails.List</FETCH>
            <FETCH>MailingName.List</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  const response = await postToTally(xml);

  if (!response || !response.success || !response.data) {
    throw new Error('Tally did not return the stock items.');
  }

  const responseXml = String(response.data);
  const tallyError = getTagValue(responseXml, 'LINEERROR');

  if (tallyError) {
    throw new Error('Tally error: ' + tallyError);
  }


const stockGroupGstRates = tallyCompanyGstEnabled
  ? new Map()
  : await getProductSyncStockGroupGstRates();




  // Use Tally's stable GUID as the product identity.
const productsByIdentity = new Map();





  const itemRegex =
  /<STOCKITEM(?=[\s>])[^>]*>[\s\S]*?<\/STOCKITEM>/gi;

  let match;

  while ((match = itemRegex.exec(responseXml)) !== null) {
    const itemXml = match[0];


const stockItemStart =
  itemXml.match(/<STOCKITEM(?=[\s>])[^>]*>/i)?.[0] || '';

const guidAttribute = stockItemStart.match(
  /\bGUID="([^"]*)"/i
);

const tallyGuid = String(
  getTagValue(itemXml, 'GUID') ||
  (guidAttribute ? decodeXml(guidAttribute[1]) : '')
).trim();

const guidCheckName =
  itemXml.match(/\bNAME="([^"]*)"/i)?.[1] ||
  getTagValue(itemXml, 'NAME') ||
  '(unknown stock item)';

if (
  !tallyGuid &&
  guidCheckName !== '(unknown stock item)'
) {
  console.warn(
    '[PRODUCT GUID CHECK] GUID MISSING | Stock item:',
    decodeXml(guidCheckName).trim()
  );
}

const tallyGuidKey = tallyGuid.toLowerCase();

const isDeletedInTally = /^(yes|true|1)$/i.test(
  String(
    getTagValue(itemXml, 'ISDELETED') || ''
  ).trim()
);

if (!tallyGuid) {
 
  continue;
}

    const nameAttribute = itemXml.match(
  /<STOCKITEM(?![\w.])[^>]*\bNAME="([^"]*)"/i
);

    const name = decodeXml(
      nameAttribute
        ? nameAttribute[1]
        : getTagValue(itemXml, 'NAME') || ''
    ).trim();

    if (!name) {


  console.warn(
    '[PRODUCT SYNC] Skipping item without a product name.'
  );

  continue;
}

    // Tally-deleted items should not be treated as active.
if (isDeletedInTally) {
  continue;
}


const productKey = normalizeProductName(name);

const identityKey = tallyGuidKey
  ? `guid:${tallyGuidKey}`
  : `name:${productKey}`;

    

    const alternativeQuantity = getStockNumber(
  getTagValue(itemXml, 'DENOMINATOR')
);



const product = {
  product_name: name,

  // Tally "Under" -> Supabase category
  category: getTagValue(itemXml, 'PARENT') || null,

  // Tally "Category" -> Supabase brand
  brand: getTagValue(itemXml, 'CATEGORY') || null,

  // Tally "Units" -> Supabase unit
  unit: (() => {
  const rawUnit = String(
    getTagValue(itemXml, 'BASEUNITS') || ''
  )
    .replace(/^[\u0000-\u001F\u007F]+/, '')
    .trim();

  if (
    !rawUnit ||
    /^(not applicable|not set|none|nil|default)$/i.test(rawUnit)
  ) {
    return defaultProductUnit;
  }

  return rawUnit;
})(),

  // Tally "Alternate units" -> Supabase alternative_unit
  alternative_unit:
    getTagValue(itemXml, 'ADDITIONALUNITS') || null,

  // Alternate-unit conversion quantity
  alternative_quantity: alternativeQuantity,

  // Tally MRP -> Supabase mrp
  mrp: getTallyMrp(itemXml),

  details: getTagValue(itemXml, 'DESCRIPTION') || null,


};


// Store Tally's stable identity for future syncs.
if (tallyGuid) {
  product.tally_guid = tallyGuid;
}

const latestStandardCost =
  getLatestApplicableStandardCost(itemXml);

const selectedPrice = getSelectedSellingPrice(
  itemXml,
  pricingMethod,
  priceLevelNames
);

if (pricingMethod === 'price_levels') {
  if (selectedPrice.highest !== null) {
    product.price_c = selectedPrice.highest;
  }

  if (selectedPrice.medium !== null) {
    product.price_b = selectedPrice.medium;
  }

  if (selectedPrice.lowest !== null) {
    product.price_a = selectedPrice.lowest;
  }

  if (selectedPrice.special !== null) {
    product.price_d = selectedPrice.special;
  }

} else if (selectedPrice !== null) {
  // Standard selling price or opening price.
  product.price_c = selectedPrice;

  // Use the selected price multiplied by the alternative-unit
  // conversion quantity, but only if that alternate unit exists.
  const altUnit = String(
    getTagValue(itemXml, 'ADDITIONALUNITS') || ''
  )
    .replace(/^[\u0000-\u001F\u007F]+/, '')
    .trim();

  const altQty = getStockNumber(
    getTagValue(itemXml, 'DENOMINATOR')
  );

  if (
    altUnit &&
    !/not applicable/i.test(altUnit) &&
    altQty !== null &&
    altQty > 0
  ) {
    product.price_b = selectedPrice;
  }
}

if (latestStandardCost !== null) {
  product.purchase_price = latestStandardCost;
}


if (!tallyCompanyGstEnabled) {
  const itemGstRate =
    parseProductSyncGstRate(itemXml);

  const gstSource = String(
    getTagValue(itemXml, 'SRCOFGSTDETAILS') || ''
  ).trim().toLowerCase();

  const hasExplicitItemGstConfiguration =
    gstSource.includes('specify details here') ||
    gstSource.includes('specify slab-based rates');

  const stockGroupGstRate =
    itemGstRate !== null ||
    hasExplicitItemGstConfiguration
      ? null
      : resolveProductSyncStockGroupGstRate(
          getTagValue(itemXml, 'PARENT'),
          stockGroupGstRates
        );

  const resolvedGstRate =
    itemGstRate !== null
      ? itemGstRate
      : stockGroupGstRate;

  if (resolvedGstRate !== null) {
    product.gst_rate = resolvedGstRate;
  }
}




    // Read Part No. from either the XML tag or STOCKITEM attribute.
const partNoTag = getTagValue(itemXml, 'PARTNO');

const stockItemStart2 =
  itemXml.match(/<STOCKITEM\b[^>]*>/i)?.[0] || '';

const partNoAttribute = stockItemStart.match(
  /\bPARTNO="([^"]*)"/i
);

const partNo = String(
  partNoTag ||
  (partNoAttribute ? decodeXml(partNoAttribute[1]) : '')
).trim();

if (partNo) {
  product.product_code = partNo;
}

// Read Part No. from Tally's MAILINGNAME field
const partNoFromTally = String(
  getTagValue(itemXml, 'MAILINGNAME') ||
  getTagValue(itemXml, 'PARTNO') ||
  ''
).trim();

if (partNoFromTally) {
  product.product_code = partNoFromTally;
}

removeTallyDefaultValues(product);

    // Closing stock is not a product change for this sync.
const fingerprintFields = { ...product };
delete fingerprintFields.closing_stock;

productsByIdentity.set(identityKey, {
  product_key: identityKey,
  fields: product,
  fingerprint: JSON.stringify(fingerprintFields)
});
  }

  const products = [...productsByIdentity.values()];

 if (products.length === 0) {
  throw new Error(
    'Tally returned no valid active stock items. ' +
    'No product changes were made.'
  );
}

// Use the local cache before making any Supabase request.
const cacheRoot = loadJsonFile(stockCacheFile) || {};

if (
  !cacheRoot.productSyncByCompany ||
  typeof cacheRoot.productSyncByCompany !== 'object'
) {
  cacheRoot.productSyncByCompany = {};
}

const previousCompanyCache =
  cacheRoot.productSyncByCompany[tallyCompanyId];

const companyCache =
  previousCompanyCache &&
  typeof previousCompanyCache === 'object' &&
  !Array.isArray(previousCompanyCache)
    ? previousCompanyCache
    : {};


const initialProductImportEnabled =
  String(
    process.env.SYNC_PRODUCTS_TO_ORDER_FLOW || ''
  ).trim().toLowerCase() === 'true';

const hasExistingProductCache =
  Object.keys(companyCache).some(
    key => key !== '__initialBaselineComplete'
  );

// If initial product import is disabled and this company
// has no existing product cache, record a local baseline.
// Do not upload the existing products to Supabase.
if (
  companyCache.__initialBaselineComplete !== true &&
  !initialProductImportEnabled &&
  !hasExistingProductCache
) {
  for (const item of products) {
    companyCache[item.product_key] = item.fingerprint;
  }

  companyCache.__initialBaselineComplete = true;

  cacheRoot.productSyncByCompany[tallyCompanyId] =
    companyCache;

  if (!saveJsonFile(stockCacheFile, cacheRoot)) {
    throw new Error(
      'Could not save the initial product baseline.'
    );
  }

  console.log(
    '[PRODUCT SYNC] Initial import disabled. ' +
    `Saved local baseline for ${products.length} products; ` +
    'nothing uploaded to Supabase.'
  );

  return {
    inserted: 0,
    updated: 0,
    unchanged: products.length,
    baselineOnly: true
  };
}


let inserted = 0;
let updated = 0;
let unchanged = 0;

for (const item of products) {
  const productKey = item.product_key;
  const fields = item.fields;
  const fingerprint = item.fingerprint;

  // FIRST: compare the Tally product with the cached fingerprint.
  if (companyCache[productKey] === fingerprint) {
    unchanged++;
    continue;
  }

  // Only new or changed products reach the Edge Function.
  // It matches existing rows by GUID before inserting.
  const productToSync = { ...fields };
delete productToSync.closing_stock;

await assertActiveCompanyMatchesEnv();

const saveResult = await writeProductThroughEdgeFunction(
  productToSync,
  null
);

  // Count the action confirmed by the Edge Function.
  const productName =
  fields.name ||
  fields.product_name ||
  '(name not available)';

const supabaseId =
  saveResult.product?.id ?? '(not returned)';

if (saveResult.action === 'inserted') {
  inserted++;

  console.log(
    `[PRODUCT SYNC] NEW PRODUCT ADDED | ` +
    `Name: ${productName} | ` +
    `Product key: ${productKey} | ` +
    `Supabase ID: ${supabaseId}`
  );

} else if (saveResult.action === 'updated') {
  updated++;

  console.log(
    `[PRODUCT SYNC] PRODUCT UPDATED | ` +
    `Name: ${productName} | ` +
    `Product key: ${productKey} | ` +
    `Supabase ID: ${supabaseId}`
  );
}

  // Update the cache only after the write succeeded.
  companyCache[productKey] = fingerprint;
}

companyCache.__initialBaselineComplete = true;


  cacheRoot.productSyncByCompany[tallyCompanyId] = companyCache;

  if (!saveJsonFile(stockCacheFile, cacheRoot)) {
    throw new Error(
      'Products synced, but the local product cache could not be saved.'
    );
  }

  if (inserted > 0 || updated > 0) {
  console.log(
    `[PRODUCT SYNC] Finished. Added: ${inserted}, updated: ${updated}`
  );
}

  return { inserted, updated, unchanged };
}


async function fetchCustomersFromTally() {
  const cleanCustomerText = (value) => {
  const cleaned = String(value ?? '')
    .replace(/^[\u0000-\u001F\u007F]+/, '')
    .trim()
    .replace(/\s+/g, ' ');

  const defaultValues = [
    'not applicable',
    'not set',
    'none',
    'nil',
    'default',
    'not defined',
    'not available'
  ];

  if (
    !cleaned ||
    defaultValues.includes(cleaned.toLowerCase())
  ) {
    return '';
  }

  return cleaned;
};
  console.log('[CUSTOMER SYNC] Fetching customers from Tally...');

  const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>EXPORT</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>TallyBridgeCustomers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="TallyBridgeCustomers">
            <TYPE>Ledger</TYPE>
            <CHILDOF>$$GroupSundryDebtors</CHILDOF>
            <BELONGSTO>Yes</BELONGSTO>
            <FETCH>Name</FETCH>
            <FETCH>Parent</FETCH>
            <FETCH>Address.List</FETCH>
            <FETCH>LedgerMobile</FETCH>
            <FETCH>LedgerPhone</FETCH>
            <FETCH>PhoneNumber</FETCH>
            <FETCH>MobileNumber</FETCH>
            <FETCH>ClosingBalance</FETCH>
            <FETCH>PriceLevelApplicable</FETCH>
            <FETCH>PriceLevel</FETCH>
            <FETCH>PriceLevel.List</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  const response = await postToTally(xml);

  if (!response || !response.success || !response.data) {
    throw new Error('Tally did not return customer details.');
  }

  const responseXml = String(response.data);
  const tallyError = getTagValue(responseXml, 'LINEERROR');

  if (tallyError) {
    throw new Error('Tally customer fetch error: ' + tallyError);
  }

  function parseCustomerBalance(value) {
  const raw = String(value || '').trim();

  const balanceMatch = raw
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/);

  if (!balanceMatch) return 0;

  const amount = Number(balanceMatch[0]);

  // Debit balance should be positive.
  if (/\bDR\b/i.test(raw)) {
    return Math.abs(amount);
  }

  // Credit balance should be negative.
  if (/\bCR\b/i.test(raw)) {
    return -Math.abs(amount);
  }

  return -amount;
}

  const customers = [];
  const ledgerRegex =
    /<LEDGER(?=[\s>])[^>]*>[\s\S]*?<\/LEDGER>/gi;

  let match;

  while ((match = ledgerRegex.exec(responseXml)) !== null) {
    const itemXml = match[0];

    const ledgerStart =
      itemXml.match(/<LEDGER(?=[\s>])[^>]*>/i)?.[0] || '';

    const nameAttribute =
      ledgerStart.match(/\bNAME="([^"]*)"/i);

    const customerName = cleanCustomerText(
  decodeXml(
    nameAttribute
      ? nameAttribute[1]
      : getTagValue(itemXml, 'NAME') || ''
  )
);

    if (!customerName) continue;

    const addressBlock =
      itemXml.match(
        /<ADDRESS\.LIST\b[^>]*>([\s\S]*?)<\/ADDRESS\.LIST>/i
      )?.[1] || '';

    const addressParts = [
      ...addressBlock.matchAll(
        /<ADDRESS(?![\w.])[^>]*>([\s\S]*?)<\/ADDRESS>/gi
      )
    ]
      .map(address =>
        decodeXml(
          address[1].replace(/<[^>]+>/g, ' ').trim()
        )
      )
      .filter(Boolean);

    const place = addressParts.join(', ');

    const mobile = String(
      getTagValue(itemXml, 'LEDGERMOBILE') ||
      getTagValue(itemXml, 'MOBILENUMBER') ||
      getTagValue(itemXml, 'LEDGERPHONE') ||
      getTagValue(itemXml, 'PHONENUMBER') ||
      ''
    ).trim();

    const rawClosingBalance =
  getTagValue(itemXml, 'CLOSINGBALANCE');

console.log(
  '[BALANCE DEBUG]',
  customerName,
  'Raw Tally balance:',
  JSON.stringify(rawClosingBalance)
);

const balance = parseCustomerBalance(rawClosingBalance);

console.log(
  '[BALANCE RESULT]',
  customerName,
  'Raw:',
  rawClosingBalance,
  'Converted:',
  balance
);

    
const parentGroup = String(
  getTagValue(itemXml, 'PARENT') || ''
).trim();

const usablePriceLevel = [
  getTagValue(itemXml, 'PRICELEVELAPPLICABLE'),
  getTagValue(itemXml, 'PRICELEVEL'),
  getTagValue(itemXml, 'PRICELEVEL.LIST')
]
  .map(cleanCustomerText)
  .find(value =>
    value &&
    !/^(not applicable|not set|none|nil|default)$/i.test(value)
  );

const fallbackPrice = cleanCustomerText(
  process.env.PRICE_LEVEL_HIGHEST || ''
);

const normalizedPricingMethod = String(
  pricingMethod || 'standard'
).trim().toLowerCase().replace(/[\s-]+/g, '_');

const customerPrice =
  normalizedPricingMethod === 'price_levels'
    ? (usablePriceLevel || fallbackPrice || 'Price')
    : 'Price';


const customerBeat =
  !parentGroup ||
  /^sundry debtors$/i.test(parentGroup) ||
  /^(not applicable|not set|none|nil|default|not defined|not available)$/i.test(parentGroup)
    ? defaultCustomerArea
    : parentGroup;


customers.push({
  customer_name: customerName,
  place: place || null,
  mobile: mobile || null,
  balance,
  price: customerPrice,
  beat: customerBeat
});

  }

  if (customers.length === 0) {
    throw new Error(
      'No customer ledgers were returned from Tally. ' +
      'Check that customers are under Sundry Debtors.'
    );
  }

  console.log(
    `[CUSTOMER SYNC] Fetched ${customers.length} customer ledgers from Tally.`
  );

  return customers;
}


async function writeCustomersThroughEdgeFunction(customers) {
  if (!supabaseUrl || !supabaseKey || !bridgeSecret) {
    throw new Error(
      'Supabase URL, API key, or bridge secret is missing.'
    );
  }

  if (!Array.isArray(customers) || customers.length === 0) {
    throw new Error(
      'No customer records are available to upload.'
    );
  }

  const functionUrl =
    `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/tally-bridge-customers`;

  console.log(
    `[CUSTOMER SYNC] Sending ${customers.length} customers to Supabase...`
  );

  try {
    const response = await axios.post(
      functionUrl,
      {
        bridge_secret: bridgeSecret,
        customers
      },
      {
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        },
        timeout: 60000
      }
    );

    if (!response.data || response.data.success !== true) {
      throw new Error(
        response.data?.error ||
        'Supabase did not confirm the customer import.'
      );
    }

    console.log(
      `[CUSTOMER SYNC] Import successful. ` +
      `Customers inserted: ${response.data.inserted}.`
    );

    return {
      success: true,
      inserted: response.data.inserted,
      companyId: response.data.company_id
    };

  } catch (error) {
    const status = error.response?.status || null;

    const serverMessage =
      error.response?.data?.error ||
      error.message ||
      'Unknown error';

    console.error(
      '[CUSTOMER SYNC ERROR]',
      JSON.stringify({
        stage: 'Supabase customer import',
        status,
        message: serverMessage
      })
    );

    throw new Error(
      `Customer import failed${status ? ` (HTTP ${status})` : ''}: ` +
      serverMessage
    );
  }
}


async function syncCustomersToSupabaseOnce() {
  if (!syncCustomersToOrderFlowEnabled) {
    console.log(
      '[CUSTOMER SYNC] Skipped: checkbox is unchecked.'
    );

    return {
      success: true,
      skipped: true,
      inserted: 0
    };
  }

  if (!tallyCompanyId) {
    throw new Error(
      'Company ID is missing from the bridge configuration.'
    );
  }

  const state = loadJsonFile(customerSyncStateFile) || {};

  if (state[tallyCompanyId]?.completed === true) {
    console.log(
      '[CUSTOMER SYNC] Already completed for this company. Skipping.'
    );

    return {
      success: true,
      skipped: true,
      alreadyCompleted: true,
      inserted: 0
    };
  }

  console.log(
    '[CUSTOMER SYNC] Starting the initial customer import.'
  );

  const customers = await fetchCustomersFromTally();

  
if (CUSTOMER_SYNC_PREVIEW_ONLY) {
  console.log(
    '[CUSTOMER SYNC PREVIEW] Customers fetched:',
    customers.length
  );

  console.log(
    '[CUSTOMER SYNC PREVIEW] First 10 customer mappings:'
  );

  console.log(
    JSON.stringify(
      customers.slice(0, 10).map(customer => ({
        customer_name: customer.customer_name,
        price: customer.price,
        beat: customer.beat,
        balance: customer.balance
      })),
      null,
      2
    )
  );

  return {
    success: true,
    previewOnly: true,
    fetched: customers.length,
    inserted: 0
  };
}


  const result =
    await writeCustomersThroughEdgeFunction(customers);

  state[tallyCompanyId] = {
    completed: true,
    completedAt: new Date().toISOString(),
    importedCount: result.inserted || 0
  };

  if (!saveJsonFile(customerSyncStateFile, state)) {
    throw new Error(
      'Customers were processed, but the completion record could not be saved.'
    );
  }

  console.log(
    '[CUSTOMER SYNC] Initial import completed. ' +
    `Inserted: ${result.inserted || 0}.`
  );

  return {
    success: true,
    inserted: result.inserted || 0
  };
}


// ========================================
// RECEIVE MANUAL PRODUCT-SYNC COMMAND
// ========================================

let productSyncInProgress = false;
let productSyncEnabled = true;
let startupCompanyName = null;
let productSyncBlocked = false;
let commandBuffer = '';

function sendProductSyncResult(result) {
  process.stdout.write(
    'PRODUCT_SYNC_RESULT:' +
    JSON.stringify(result) +
    '\n'
  );
}


function sendCustomerSyncResult(result) {
  process.stdout.write(
    'CUSTOMER_SYNC_RESULT:' +
    JSON.stringify(result) +
    '\n'
  );
}


// Log unexpected errors in the Tally Bridge process.
process.on('uncaughtException', (error) => {
  console.error(
    '[FATAL] Unexpected bridge error:',
    error.stack || error.message || String(error)
  );

  process.exit(1);
});

// Log asynchronous errors that were not handled.
process.on('unhandledRejection', (reason) => {
  const details = reason instanceof Error
    ? reason.stack || reason.message
    : String(reason);

  console.error(
    '[UNHANDLED PROMISE ERROR]',
    details
  );
});

process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  commandBuffer += chunk;

  const lines = commandBuffer.split(/\r?\n/);
  commandBuffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;

    let command;

    try {
      command = JSON.parse(line);
    } catch {
      console.error('[BRIDGE] Invalid tray command.');
      continue;
    }

    if (command.command === 'set-product-sync') {
  if (typeof command.enabled === 'boolean') {
    productSyncEnabled = command.enabled;

    console.log(
      '[PRODUCT AUTO SYNC]',
      productSyncEnabled ? 'ENABLED' : 'PAUSED'
    );

    sendProductSyncResult({
      success: true,
      productSyncEnabled
    });
  }

  continue;
}


if (command.command === 'sync-customers-once') {
  syncCustomersToSupabaseOnce()
    .then(result => {
      sendCustomerSyncResult({
        success: true,
        ...result
      });
    })
    .catch(error => {
      console.error(
        '[CUSTOMER SYNC ERROR]',
        error.message
      );

      sendCustomerSyncResult({
        success: false,
        error: error.message
      });
    });

  continue;
}


if (command.command !== 'sync-products') continue;

if (!productSyncEnabled) {
  sendProductSyncResult({
    success: false,
    error: 'Product sync is paused.'
  });
  continue;
}

    if (productSyncInProgress) {
      sendProductSyncResult({
        success: false,
        error: 'Product sync is already running.'
      });
      continue;
    }

    productSyncInProgress = true;

    syncProductsToSupabase()
      .then(result => {
        sendProductSyncResult({
          success: true,
          ...result
        });
      })
      .catch(error => {
        console.error('[PRODUCT SYNC ERROR]', error.message);

        sendProductSyncResult({
          success: false,
          error: error.message
        });
      })
      .finally(() => {
        productSyncInProgress = false;
      });
  }
});

// Automatically check Tally products every 60 seconds.
// Cache comparisons decide whether a Supabase write is necessary.
const PRODUCT_SYNC_INTERVAL_MS = 60 * 1000;

setInterval(async () => {
  if (!productSyncEnabled || productSyncInProgress) {
  return;
}

  productSyncInProgress = true;

  try {
    const result = await syncProductsToSupabase();

    if (result.inserted > 0 || result.updated > 0) {
  console.log(
    '[PRODUCT AUTO SYNC] Products changed. ' +
    `Added: ${result.inserted}, updated: ${result.updated}`
  );
}
  } catch (error) {
    console.error(
      '[PRODUCT AUTO SYNC ERROR]',
      error.message
    );
  } finally {
    productSyncInProgress = false;
  }
}, PRODUCT_SYNC_INTERVAL_MS);


 // Record the initial product baseline immediately when
 // initial product import is disabled.
const initialProductImportEnabled =
  String(
    process.env.SYNC_PRODUCTS_TO_ORDER_FLOW || ''
  ).trim().toLowerCase() === 'true';

if (!initialProductImportEnabled) {
  (async () => {
    if (productSyncInProgress) return;

    productSyncInProgress = true;

    try {
      const result = await syncProductsToSupabase();

      console.log(
        '[PRODUCT BASELINE] Startup check completed.',
        JSON.stringify(result)
      );
    } catch (error) {
      console.error(
        '[PRODUCT BASELINE ERROR]',
        error.message
      );
    } finally {
      productSyncInProgress = false;
    }
  })();
}




// =================================
// LOAD SALES LEDGER CACHE
// =================================

function loadSalesLedgerCache() {

  return loadJsonFile(
    salesLedgerCacheFile
  );

}


// =================================
// SAVE SALES LEDGER CACHE
// =================================

function saveSalesLedgerCache(
  salesLedger
) {

  const data =
  {

    salesLedger:
      salesLedger

  };


  const saved =
    saveJsonFile(

      salesLedgerCacheFile,

      data

    );


  if (
    saved
  ) {

    console.log(
      'Sales ledger cached:',
      salesLedger
    );

  }


  return saved;

}




// =================================
// FETCH SALES LEDGERS FROM TALLY
// =================================

async function fetchSalesLedgers() {

  console.log(
    'Detecting Sales ledgers from Tally...'
  );


  const xml = `

<ENVELOPE>

  <HEADER>

    <VERSION>
      1
    </VERSION>

    <TALLYREQUEST>
      EXPORT
    </TALLYREQUEST>

    <TYPE>
      COLLECTION
    </TYPE>

    <ID>
      TallyBridgeSalesLedgers
    </ID>

  </HEADER>


  <BODY>

    <DESC>

      <STATICVARIABLES>

        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>

      </STATICVARIABLES>


      <TDL>

        <TDLMESSAGE>

          <COLLECTION
            NAME="TallyBridgeSalesLedgers"
          >

            <TYPE>
              Ledger
            </TYPE>


            <FETCH>

              Name,

              Parent

            </FETCH>


            <FILTERS>

              TallyBridgeSalesLedgerFilter

            </FILTERS>

          </COLLECTION>


          <SYSTEM
            TYPE="Formulae"
            NAME="TallyBridgeSalesLedgerFilter"
          >

            $Parent = "Sales Accounts"

          </SYSTEM>


        </TDLMESSAGE>

      </TDL>

    </DESC>

  </BODY>

</ENVELOPE>

`;


  const result =
    await postToTally(
      xml
    );


  if (
    !result.success
  ) {

    return null;

  }


  console.log('');

  console.log(
    '=========================================='
  );

  console.log(
    'RAW TALLY LEDGER RESPONSE'
  );

  console.log(
    '=========================================='
  );

  console.log(
    result.data
  );

  console.log(
    '=========================================='
  );

  console.log('');


  return result.data;

}


// =================================
// PARSE SALES LEDGERS
// =================================

function parseSalesLedgers(
  xml
) {

  const ledgers =
    [];


  if (
    !xml
  ) {

    return ledgers;

  }


  const ledgerRegex =
    /<LEDGER\b([^>]*)>([\s\S]*?)<\/LEDGER>/gi;


  let match;


  while (

    (
      match =
      ledgerRegex.exec(
        xml
      )
    )

  ) {

    const attributes =
      match[1] ||
      '';


    const ledgerXml =
      match[2] ||
      '';


    // -----------------------------
    // GET NAME
    // -----------------------------

    const attributeNameMatch =
      attributes.match(
        /\bNAME\s*=\s*"([^"]*)"/i
      );


    let name =
      attributeNameMatch
        ? attributeNameMatch[1]
        : null;


    if (
      !name
    ) {

      name =
        getTagValue(
          ledgerXml,
          'NAME'
        );

    }


    // -----------------------------
    // GET PARENT
    // -----------------------------

    const parent =
      getTagValue(
        ledgerXml,
        'PARENT'
      );


    console.log(
      'Tally ledger found:',
      {

        name,

        parent

      }
    );


    // -----------------------------
    // VALIDATE
    // -----------------------------

    if (
      !name
    ) {

      continue;

    }


    // -----------------------------
    // SALES ACCOUNTS ONLY
    // -----------------------------

    if (

      normalizeName(
        parent
      )

      ===

      normalizeName(
        'Sales Accounts'
      )

    ) {

      ledgers.push(
        String(
          name
        ).trim()
      );

    }

  }


  // Remove duplicates

  return [

    ...new Set(
      ledgers
    )

  ];

}

// =================================
// CHOOSE SALES LEDGER
// =================================

function chooseSalesLedger(
  ledgers
) {

  if (

    !Array.isArray(
      ledgers
    )

    ||

    ledgers.length ===
    0

  ) {

    return null;

  }


  // =================================
  // ONLY ONE SALES LEDGER
  // =================================

  if (
    ledgers.length ===
    1
  ) {

    return ledgers[0];

  }


  // =================================
  // MULTIPLE SALES LEDGERS
  // DO NOT GUESS
  // =================================

  console.error('');
  
  console.error(
    '=========================================='
  );

  console.error(
    'MULTIPLE SALES LEDGERS FOUND'
  );

  console.error(
    '=========================================='
  );

  console.error(
    'Please configure SALES_LEDGER in Tally Setup.'
  );

  console.error(
    'Detected Sales ledgers:',
    ledgers
  );

  console.error('');

  return null;

}

async function getSalesLedger() {

  // =================================
  // CHECK CONFIGURED SALES LEDGER
  // =================================

  if (salesLedger) {

    console.log(
      'Using configured Sales ledger:',
      salesLedger
    );

    return salesLedger;

  }


  // =================================
  // CHECK CACHE FIRST
  // =================================

  const cached =
    loadSalesLedgerCache();


  if (

    cached &&

    cached.salesLedger

  ) {

    console.log(
      'Using cached Sales ledger:',
      cached.salesLedger
    );


    return cached.salesLedger;

  }


  // =================================
  // FETCH FROM TALLY
  // =================================

  const xml =
    await fetchSalesLedgers();


  if (
    !xml
  ) {

    console.error(
      'Could not detect Sales ledgers from Tally.'
    );


    return null;

  }


  // =================================
  // PARSE SALES LEDGERS
  // =================================

  const ledgers =
    parseSalesLedgers(
      xml
    );


  console.log(
    'Sales ledgers detected:'
  );


  console.log(
    ledgers
  );


  // =================================
  // CHOOSE SALES LEDGER
  // =================================

  const selectedLedger =
    chooseSalesLedger(
      ledgers
    );


  if (
    !selectedLedger
  ) {

    console.error('');

    console.error(
      '=========================================='
    );

    console.error(
      'SALES LEDGER COULD NOT BE SELECTED'
    );

    console.error(
      '=========================================='
    );

    console.error(
      'Detected Sales ledgers:'
    );

    console.error(
      ledgers
    );

    console.error('');

    console.error(
      'Invoice generation stopped safely.'
    );

    console.error('');

    return null;

  }


  // =================================
  // SAVE CACHE
  // =================================

  saveSalesLedgerCache(
    selectedLedger
  );


  console.log(
    'Automatically selected Sales ledger:',
    selectedLedger
  );


  return selectedLedger;

}

// =================================
// FETCH SALES VOUCHER TYPES FROM TALLY
// =================================

async function fetchSalesVoucherTypes() {

  console.log(
    'Detecting Sales Voucher Types from Tally...'
  );


  const xml = `

<ENVELOPE>

  <HEADER>

    <VERSION>
      1
    </VERSION>

    <TALLYREQUEST>
      EXPORT
    </TALLYREQUEST>

    <TYPE>
      COLLECTION
    </TYPE>

    <ID>
      TallyBridgeSalesVoucherTypes
    </ID>

  </HEADER>


  <BODY>

    <DESC>

      <STATICVARIABLES>

        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>

      </STATICVARIABLES>


      <TDL>

        <TDLMESSAGE>

          <COLLECTION
  NAME="TallyBridgeSalesVoucherTypes"
>

  <TYPE>
    VoucherType
  </TYPE>

  <FETCH>
    Name,
    Parent
  </FETCH>

  <FILTERS>
    TallyBridgeSalesVoucherTypeFilter
  </FILTERS>

</COLLECTION>

<SYSTEM
  TYPE="Formulae"
  NAME="TallyBridgeSalesVoucherTypeFilter"
>
  $Parent = "Sales"
</SYSTEM>

        </TDLMESSAGE>

      </TDL>

    </DESC>

  </BODY>

</ENVELOPE>

`;


  const result =
    await postToTally(
      xml
    );


  if (
    !result.success
  ) {

    return null;

  }


  console.log('');

  console.log(
    '=========================================='
  );

  console.log(
    'RAW TALLY VOUCHER TYPE RESPONSE'
  );

  console.log(
    '=========================================='
  );

  console.log(
    result.data
  );

  console.log(
    '=========================================='
  );

  console.log('');


  return result.data;

}

// =================================
// PARSE SALES VOUCHER TYPES
// =================================

function parseSalesVoucherTypes(xml) {

  if (!xml) {
    return [];
  }


  const voucherTypes = [];

  const regex =
    /<VOUCHERTYPE\b[^>]*>([\s\S]*?)<\/VOUCHERTYPE>/gi;

  let match;


  while (
    (match = regex.exec(xml)) !== null
  ) {

    const block =
      match[0];


    // Try NAME attribute first

    const attributeMatch =
      block.match(
        /\bNAME\s*=\s*"([^"]+)"/i
      );


    // Otherwise try <NAME>...</NAME>

    const nameMatch =
      block.match(
        /<NAME[^>]*>([\s\S]*?)<\/NAME>/i
      );


    const name =
      attributeMatch
        ? attributeMatch[1]
        : nameMatch
          ? nameMatch[1]
          : '';


    const cleanName =
      String(name)
        .replace(
          /<!\[CDATA\[([\s\S]*?)\]\]>/g,
          '$1'
        )
        .trim();


    if (
      cleanName &&
      !voucherTypes.includes(
        cleanName
      )
    ) {

      voucherTypes.push(
        cleanName
      );

    }

  }


  console.log(
    'Sales Voucher Types detected:'
  );

  console.log(
    voucherTypes
  );


  return voucherTypes;

}

// =================================
// CHOOSE SALES VOUCHER TYPE
// =================================

function chooseSalesVoucherType(
  voucherTypes
) {

  if (
    !Array.isArray(voucherTypes) ||
    voucherTypes.length === 0
  ) {

    return null;

  }


  // =================================
  // ONLY ONE SALES VOUCHER TYPE
  // =================================

  if (
    voucherTypes.length === 1
  ) {

    return voucherTypes[0];

  }


  // =================================
  // MULTIPLE SALES VOUCHER TYPES
  // =================================

  console.error('');

  console.error(
    '=========================================='
  );

  console.error(
    'MULTIPLE SALES VOUCHER TYPES FOUND'
  );

  console.error(
    '=========================================='
  );

  console.error(
    'Please configure SALES_VOUCHER_TYPE in Tally Setup.'
  );

  console.error(
    'Detected Sales Voucher Types:',
    voucherTypes
  );

  console.error('');

  return null;

}

// =================================
// GET SALES VOUCHER TYPE
// =================================

async function getSalesVoucherType() {

  // =================================
  // CHECK CONFIGURED SALES VOUCHER TYPE
  // =================================

  if (salesVoucherType) {

    console.log(
      'Using configured Sales Voucher Type:',
      salesVoucherType
    );

    return salesVoucherType;

  }


  // =================================
  // FETCH FROM TALLY
  // =================================

  const xml =
    await fetchSalesVoucherTypes();


  if (
    !xml
  ) {

    console.error(
      'Could not detect Sales Voucher Types from Tally.'
    );

    return null;

  }


  // =================================
  // PARSE SALES VOUCHER TYPES
  // =================================

  const voucherTypes =
    parseSalesVoucherTypes(
      xml
    );


  // =================================
  // CHOOSE SALES VOUCHER TYPE
  // =================================

  const selectedVoucherType =
    chooseSalesVoucherType(
      voucherTypes
    );


  if (
    !selectedVoucherType
  ) {

    console.error('');

    console.error(
      '=========================================='
    );

    console.error(
      'SALES VOUCHER TYPE COULD NOT BE SELECTED'
    );

    console.error(
      '=========================================='
    );

    console.error(
      'Detected Sales Voucher Types:'
    );

    console.error(
      voucherTypes
    );

    console.error('');

    console.error(
      'Invoice generation stopped safely.'
    );

    console.error('');

    return null;

  }


  console.log(
    'Automatically selected Sales Voucher Type:',
    selectedVoucherType
  );


  return selectedVoucherType;

}

// =================================
// GET CURRENT DATE FOR INVOICE
// =================================
//
// IMPORTANT:
// We use the computer's current date.
// Format required by Tally: YYYYMMDD
//
// Example:
// 30 August 2026 -> 20260830
// =================================

function getInvoiceDate() {

  const now =
    new Date();


  const year =
    now.getFullYear();


  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      '0'
    );


  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      '0'
    );


  const invoiceDate =
    `${year}${month}${day}`;


  console.log(
    'Using invoice date:',
    invoiceDate
  );


  return invoiceDate;

}


// =================================
// ESCAPE XML
// =================================

function escapeXml(
  value
) {

  if (

    value === null ||

    value === undefined

  ) {

    return '';

  }


  return String(
    value
  )

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&apos;'
    );

}


// =================================
// CONVERT VALUE TO NUMBER
// =================================

function toNumber(
  value,
  defaultValue = 0
) {

  const number =
    Number(
      value
    );


  if (
    Number.isNaN(
      number
    )
  ) {

    return defaultValue;

  }


  return number;

}


// =================================
// FORMAT AMOUNT
// =================================

function formatAmount(
  value
) {

  const amount =
    toNumber(
      value,
      0
    );


  // Avoid unnecessary long decimals

  return String(
    Number(
      amount.toFixed(
        2
      )
    )
  );

}


// =================================
// CLEAN UNIT
// =================================

function cleanUnit(
  unit
) {

  if (

    unit === null ||

    unit === undefined

  ) {

    return '';

  }


  return String(
    unit
  )

    .trim()

    .replace(
      /\s+/g,
      ' '
    );

}


// =================================
// BUILD TALLY QUANTITY
// =================================

function buildTallyQuantity(
  quantity,
  unit
) {

  const qty =
    toNumber(
      quantity,
      0
    );


  const cleanQty =
    String(
      Number(
        qty.toFixed(
          3
        )
      )
    );


  const cleanUnitName =
    cleanUnit(
      unit
    );


  if (
    !cleanUnitName
  ) {

    return cleanQty;

  }


  return (
    cleanQty +
    ' ' +
    cleanUnitName
  );

}


// =================================
// BUILD TALLY RATE
// =================================

function buildTallyRate(
  rate,
  unit
) {

  const cleanRate =
    formatAmount(
      rate
    );


  const cleanUnitName =
    cleanUnit(
      unit
    );


  if (
    !cleanUnitName
  ) {

    return cleanRate;

  }


  return (
    cleanRate +
    '/' +
    cleanUnitName
  );

}


// =================================
// GET CUSTOMER NAME
// =================================
//
// The Edge Function may return the
// customer information in different
// places.
//
// This function safely tries them.
// =================================

function getInvoiceCustomerName(
  invoiceData
) {

  const order =
    invoiceData &&
      invoiceData.order
      ? invoiceData.order
      : {};


  const possibleNames =
    [

      // Direct order fields

      order.customer_name,

      order.costomer_name,

      order.costomer_id,

      order.party_name,


      // Nested customer objects

      order.customer &&
      order.customer.customer_name,

      order.customer &&
      order.customer.name,

      order.costomer &&
      order.costomer.customer_name,

      order.costomer &&
      order.costomer.name,


      // Top-level values

      invoiceData.customer_name,

      invoiceData.costomer_name,

      invoiceData.party_name

    ];


  for (
    const name
    of possibleNames
  ) {

    if (

      name &&

      String(
        name
      ).trim()

    ) {

      return String(
        name
      ).trim();

    }

  }


  return null;

}


// =================================
// GET PRODUCT NAME
// =================================

function getLineItemProductName(
  item
) {

  if (
    !item
  ) {

    return null;

  }


  const possibleNames =
    [

      item.product_name,

      item.product,

      item.item_name,

      item.stock_item_name,

      item.description

    ];


  for (
    const name
    of possibleNames
  ) {

    if (

      name &&

      String(
        name
      ).trim()

    ) {

      return String(
        name
      ).trim();

    }

  }


  return null;

}


// =================================
// GET LINE ITEM QUANTITY
// =================================

function getLineItemQuantity(
  item
) {

  if (
    !item
  ) {

    return 0;

  }


  return toNumber(

    item.quantity ??

    item.qty ??

    item.billed_quantity,

    0

  );

}


// =================================
// GET LINE ITEM RATE
// =================================

function getLineItemRate(
  item
) {

  if (
    !item
  ) {

    return 0;

  }


  return toNumber(

    item.rate ??

    item.price ??

    item.unit_price,

    0

  );

}


// =================================
// GET LINE ITEM TOTAL
// =================================

function getLineItemTotal(
  item
) {

  if (
    !item
  ) {

    return 0;

  }


  // Use stored line total if available

  const directTotal =

    item.line_total ??

    item.line_totel ??

    item.total ??

    item.amount;


  if (

    directTotal !== null &&

    directTotal !== undefined &&

    directTotal !== ''

  ) {

    return toNumber(
      directTotal,
      0
    );

  }


  // Otherwise calculate it

  const quantity =
    getLineItemQuantity(
      item
    );


  const rate =
    getLineItemRate(
      item
    );


  return (
    quantity *
    rate
  );

}

// =================================
// PREPARE INVOICE ITEMS FOR TALLY
// =================================

function prepareInvoiceItemsForTally(
  lineItems,
  productGSTRates,
  gstEnabled
) {

  if (
    !Array.isArray(lineItems)
  ) {
    return [];
  }


  return lineItems.map(
    (item) => {

      const productName =
        getLineItemProductName(item);


      // =================================
      // PACKING LOGIC
      // =================================

      const packStatus =
        Number(item.pack_status || 0);


      let quantity =
        0;


      let unit =
        '';


      if (
        packStatus === 1
      ) {

        quantity =
          Number(
            item.pack_quantity || 0
          );


        unit =
          cleanUnit(
            item.pack_unit ||
            item.unit
          );

      } else {

        quantity =
          Number(
            item.quantity || 0
          );


        unit =
          cleanUnit(
            item.unit
          );

      }


      // =================================
      // GROSS TOTAL
      // =================================

      const grossTotal =
        Number(
          item.line_totel ??
          item.line_total ??
          0
        );


      // =================================
      // GET GST RATE
      // =================================

      let gstRate =
        0;


      if (
        gstEnabled === true &&
        productName
      ) {

        gstRate =
          Number(
            productGSTRates[
            normalizeName(
              productName
            )
            ] || 0
          );

      }


      // =================================
      // CALCULATE TAXABLE AMOUNT
      //
      // PRICE ALREADY INCLUDES GST
      // =================================

      let taxableTotal =
        grossTotal;

      let gstAmount =
        0;

      if (
        gstEnabled
        &&
        gstRate > 0
      ) {

        // Calculate taxable amount
        taxableTotal =
          grossTotal /
          (
            1 +
            (
              gstRate / 100
            )
          );


        // Round ONLY taxable amount
        taxableTotal =
          Math.round(
            taxableTotal
          );


        // GST is the remaining amount
        gstAmount =
          grossTotal -
          taxableTotal;

      }

      // =================================
      // TALLY RATE
      // =================================

      const tallyRate =
        quantity > 0
          ? taxableTotal / quantity
          : 0;


      return {

        productName:
          productName,

        quantity:
          quantity,

        unit:
          unit,

        grossTotal:
          grossTotal,

        gstRate:
          gstRate,

        gstAmount:
          gstAmount,

        taxableTotal:
          taxableTotal,

        tallyRate:
          tallyRate

      };

    }

  );

}
// =================================
// BUILD INVENTORY ENTRIES
// =================================

function buildInventoryEntries(

  preparedItems,

  salesLedger

) {

  if (

    !Array.isArray(
      preparedItems
    )

    ||

    preparedItems.length === 0

  ) {

    throw new Error(
      'Invoice has no line items.'
    );

  }


  let entries =
    '';


  for (
    const item
    of preparedItems
  ) {


    const productName =
      item.productName;


    const quantity =
      Number(
        item.quantity
      );


    const unit =
      item.unit;


    const rate =
      Number(
        item.tallyRate
      );


    const taxableTotal =
      Number(
        item.taxableTotal
      );


    if (
      quantity < 0
    ) {

      throw new Error(

        `Invalid quantity for product: ${productName}`

      );

    }


    if (
      taxableTotal < 0
    ) {

      throw new Error(

        `Invalid amount for product: ${productName}`

      );

    }


    const tallyQuantity =
      buildTallyQuantity(

        quantity,

        unit

      );


    // =================================
    // LOG GST DETAILS
    // =================================

    console.log('');

    console.log(
      'Product:',
      productName
    );

    console.log(
      'GST Rate:',
      item.gstRate + '%'
    );

    console.log(
      'Gross Amount:',
      formatAmount(
        item.grossTotal
      )
    );

    console.log(
      'Taxable Amount:',
      formatAmount(
        taxableTotal
      )
    );

    console.log(
      'GST Amount:',
      formatAmount(
        item.gstAmount
      )
    );


    // =================================
    // BUILD XML
    // =================================

    entries += `

<ALLINVENTORYENTRIES.LIST>

  <STOCKITEMNAME>
    ${escapeXml(productName)}
  </STOCKITEMNAME>


  <ISDEEMEDPOSITIVE>
    No
  </ISDEEMEDPOSITIVE>


  <RATE>
    ${formatAmount(rate)}/${escapeXml(unit)}
  </RATE>


  <ACTUALQTY>
    ${tallyQuantity}
  </ACTUALQTY>


  <BILLEDQTY>
    ${tallyQuantity}
  </BILLEDQTY>


  <AMOUNT>
    ${formatAmount(taxableTotal)}
  </AMOUNT>


  <ACCOUNTINGALLOCATIONS.LIST>


    <LEDGERNAME>
      ${escapeXml(salesLedger)}
    </LEDGERNAME>


    <ISDEEMEDPOSITIVE>
      No
    </ISDEEMEDPOSITIVE>


    <AMOUNT>
      ${formatAmount(taxableTotal)}
    </AMOUNT>


  </ACCOUNTINGALLOCATIONS.LIST>


</ALLINVENTORYENTRIES.LIST>

`;

  }


  return entries;

}

// =================================
// BUILD GST LEDGER ENTRIES
// =================================

function buildGSTLedgerEntries(
  preparedItems
) {

  let totalGST =
    0;


  // =================================
  // CALCULATE TOTAL GST
  // =================================

  for (
    const item
    of preparedItems
  ) {

    totalGST +=
      Number(
        item.gstAmount || 0
      );

  }


  totalGST =
    Number(
      totalGST.toFixed(2)
    );


  if (
    totalGST <= 0
  ) {

    return '';

  }


  // =================================
  // SPLIT GST EQUALLY
  //
  // CGST = SGST
  // =================================

  const totalCGST =
    Number(
      (totalGST / 2).toFixed(2)
    );

  const totalSGST =
    totalCGST;


  let entries =
    '';


  // =================================
  // CGST
  // =================================

  entries += `

<LEDGERENTRIES.LIST>

  <LEDGERNAME>
    ${escapeXml(commonCgstLedger)}
  </LEDGERNAME>

  <ISDEEMEDPOSITIVE>
    No
  </ISDEEMEDPOSITIVE>

  <AMOUNT>
    ${formatAmount(totalCGST)}
  </AMOUNT>

</LEDGERENTRIES.LIST>

`;


  // =================================
  // SGST
  // =================================

  entries += `

<LEDGERENTRIES.LIST>

  <LEDGERNAME>
    ${escapeXml(commonSgstLedger)}
  </LEDGERNAME>

  <ISDEEMEDPOSITIVE>
    No
  </ISDEEMEDPOSITIVE>

  <AMOUNT>
    ${formatAmount(totalSGST)}
  </AMOUNT>

</LEDGERENTRIES.LIST>

`;


  return entries;

}


    function buildRoundOffLedgerEntry(
      roundOffAmount
    ) {

      if (
        Math.abs(roundOffAmount) < 0.001
      ) {

        return '';

      }


      if (
        !roundOffLedger
      ) {

        throw new Error(
          'ROUND_OFF_LEDGER is not configured.'
        );

      }


      const amount =
        Math.abs(
          roundOffAmount
        );


      const isDeemedPositive =
        roundOffAmount < 0
          ? 'Yes'
          : 'No';


      const signedAmount =
        roundOffAmount < 0
          ? `-${formatAmount(amount)}`
          : formatAmount(amount);


      return `

<LEDGERENTRIES.LIST>

  <LEDGERNAME>
    ${escapeXml(roundOffLedger)}
  </LEDGERNAME>

  <ISDEEMEDPOSITIVE>
    ${isDeemedPositive}
  </ISDEEMEDPOSITIVE>

  <AMOUNT>
    ${signedAmount}
  </AMOUNT>

</LEDGERENTRIES.LIST>

`;

    }

    // =================================
    // CALCULATE INVOICE TOTAL
    // =================================

    function calculateInvoiceTotal(
      lineItems
    ) {

      if (
        !Array.isArray(
          lineItems
        )
      ) {

        return 0;

      }


      let total =
        0;


      for (
        const item
        of lineItems
      ) {

        total +=
          getLineItemTotal(
            item
          );

      }


      return total;

    }

    async function assertActiveCompanyMatchesEnv() {
  if (!expectedTallyCompanyName) {
    throw new Error('TALLY_COMPANY is missing. Sync stopped.');
  }

  const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CompanyInfo</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES />
      <TDL>
        <TDLMESSAGE>
          <OBJECT NAME="CurrentCompany">
            <LOCALFORMULA>CurrentCompany:##SVCURRENTCOMPANY</LOCALFORMULA>
          </OBJECT>
          <COLLECTION NAME="CompanyInfo">
            <OBJECTS>CurrentCompany</OBJECTS>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

  const result = await postToTally(xml);

  if (!result || result.success !== true) {
    throw new Error('Cannot verify Tally company. Sync stopped.');
  }

  const responseXml = String(result.data || '');

  const activeCompany = String(
    getTagValue(responseXml, 'CURRENTCOMPANY') || ''
  ).trim();

  if (!activeCompany) {
    console.error('[COMPANY CHECK] Response:', responseXml);
    throw new Error('Tally returned no company name. Sync stopped.');
  }

  if (
    activeCompany.toLowerCase() !==
    expectedTallyCompanyName.toLowerCase()
  ) {
    throw new Error(
      `Wrong company. Expected "${expectedTallyCompanyName}", ` +
      `but active company is "${activeCompany}". Sync stopped.`
    );
  }

  console.log('[COMPANY CHECK] Verified:', activeCompany);
}

    // =================================
    // GET TALLY COMPANY GST STATUS
    // =================================

    async function getTallyCompanyGSTStatus() {

      console.log('');

      console.log(
        '=========================================='
      );

      console.log(
        'CHECKING TALLY GST STATUS'
      );

      console.log(
        '=========================================='
      );


      const xml = `

<ENVELOPE>

  <HEADER>

    <VERSION>
      1
    </VERSION>

    <TALLYREQUEST>
      EXPORT
    </TALLYREQUEST>

    <TYPE>
      DATA
    </TYPE>

    <ID>
      TallyBridgeGSTCompany
    </ID>

  </HEADER>


  <BODY>

    <DESC>

      <STATICVARIABLES>

        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>

      </STATICVARIABLES>


      <TDL>

        <TDLMESSAGE>


          <REPORT
            NAME="TallyBridgeGSTCompany"
          >

            <FORMS>
              TallyBridgeGSTCompanyForm
            </FORMS>

          </REPORT>


          <FORM
            NAME="TallyBridgeGSTCompanyForm"
          >

            <PARTS>
              TallyBridgeGSTCompanyPart
            </PARTS>

          </FORM>


          <PART
            NAME="TallyBridgeGSTCompanyPart"
          >

            <LINES>
              TallyBridgeGSTCompanyLine
            </LINES>

          </PART>


          <LINE
            NAME="TallyBridgeGSTCompanyLine"
          >

            <FIELDS>

              TallyBridgeCompanyName,

              TallyBridgeGSTRegistrationType,

              TallyBridgeGSTIN

            </FIELDS>

          </LINE>


          <FIELD
            NAME="TallyBridgeCompanyName"
          >

            <SET>
              $$CurrentCompany
            </SET>

          </FIELD>


          <FIELD
            NAME="TallyBridgeGSTRegistrationType"
          >

            <SET>
              $GSTREGISTRATIONTYPE
            </SET>

          </FIELD>


          <FIELD
            NAME="TallyBridgeGSTIN"
          >

            <SET>
              $GSTIN
            </SET>

          </FIELD>


        </TDLMESSAGE>

      </TDL>

    </DESC>

  </BODY>

</ENVELOPE>

`;


      const result =
        await postToTally(
          xml
        );


      if (
        !result ||
        result.success !== true
      ) {

        console.log(
          'Could not determine Tally GST status.'
        );

        return {

          gstEnabled:
            false,

          registrationType:
            '',

          gstin:
            ''

        };

      }


      const responseXml =
        String(
          result.data ||
          ''
        );


      console.log(
        'GST COMPANY RESPONSE:'
      );

      console.log(
        responseXml
      );

      const companyName = String(
  getTagValue(responseXml, 'TALLYBRIDGECOMPANYNAME') || ''
).trim();


      const registrationType =
        getTagValue(
          responseXml,
          'TALLYBRIDGEGSTREGISTRATIONTYPE'
        )

        ||

        getTagValue(
          responseXml,
          'GSTREGISTRATIONTYPE'
        )

        ||

        '';


      const gstin =
        getTagValue(
          responseXml,
          'TALLYBRIDGEGSTIN'
        )

        ||

        getTagValue(
          responseXml,
          'GSTIN'
        )

        ||

        '';


      const normalizedRegistration =
        String(
          registrationType
        )

          .trim()

          .toLowerCase();


      const normalizedGSTIN =
        String(
          gstin
        )

          .trim();


      // =================================
      // DETERMINE GST STATUS
      // =================================

      let gstEnabled =
        false;


      // GSTIN exists

      if (
        normalizedGSTIN.length >= 10
      ) {

        gstEnabled =
          true;

      }


      // Registration type exists

      if (

        normalizedRegistration

        &&

        normalizedRegistration !==
        'not applicable'

        &&

        normalizedRegistration !==
        'unregistered'

        &&

        normalizedRegistration !==
        'none'

      ) {

        gstEnabled =
          true;

      }


      console.log('');

      console.log(
        'Tally GST Registered:',
        gstEnabled
      );

      console.log(
        'GST Registration Type:',
        registrationType || 'Not available'
      );

      console.log(
        'GSTIN:',
        gstin || 'Not available'
      );

      console.log('');


      return {
  companyName,
  gstEnabled,
  registrationType,
  gstin
};

    }

    // =================================
    // GET GST RATES FROM TALLY PRODUCTS
    // =================================

    async function getTallyProductGSTRates() {

      console.log('');

      console.log(
        '=========================================='
      );

      console.log(
        'FETCHING PRODUCT GST RATES FROM TALLY'
      );

      console.log(
        '=========================================='
      );


      const xml = `

<ENVELOPE>

  <HEADER>

    <VERSION>
      1
    </VERSION>

    <TALLYREQUEST>
      EXPORT
    </TALLYREQUEST>

    <TYPE>
      COLLECTION
    </TYPE>

    <ID>
      TallyBridgeGSTStockItems
    </ID>

  </HEADER>


  <BODY>

    <DESC>

      <STATICVARIABLES>

        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>

      </STATICVARIABLES>


      <TDL>

        <TDLMESSAGE>


          <COLLECTION
            NAME="TallyBridgeGSTStockItems"
          >

            <TYPE>
              StockItem
            </TYPE>


            <FETCH>
              Name
            </FETCH>


            <FETCH>
              GSTDETAILS.LIST
            </FETCH>


            <FETCH>
              GSTRATEDETAILS.LIST
            </FETCH>


            <FETCH>
              GSTRATEDUTYHEAD
            </FETCH>


            <FETCH>
              GSTRATE
            </FETCH>


          </COLLECTION>


        </TDLMESSAGE>

      </TDL>

    </DESC>

  </BODY>

</ENVELOPE>

`;


      const result =
        await postToTally(
          xml
        );

      console.log('');

      console.log(
        '=========================================='
      );

      console.log(
        'RAW PRODUCT GST RESPONSE'
      );

      console.log(
        '=========================================='
      );

      console.log(
        result
      );

      console.log('');

      console.log(
        result.data
      );

      console.log('');


      if (
        !result ||
        result.success !== true
      ) {

        console.error(
          'Could not fetch GST rates from Tally.'
        );

        return {};

      }


      const responseXml =
        String(
          result.data ||
          ''
        );


      console.log(
        'PRODUCT GST RESPONSE RECEIVED'
      );


      return parseTallyProductGSTRates(
        responseXml
      );

    }

    // =================================
    // PARSE TALLY PRODUCT GST RATES
    // =================================

    function parseTallyProductGSTRates(
      xml
    ) {

      const productRates =
        {};


      if (
        !xml
      ) {

        return productRates;

      }


      // =================================
      // FIND STOCK ITEMS
      // =================================

      const stockItemRegex =
        /<STOCKITEM\b[^>]*>[\s\S]*?<\/STOCKITEM>/gi;


      let stockMatch;


      while (

        (
          stockMatch =
          stockItemRegex.exec(
            xml
          )
        )
        !== null

      ) {


        const stockItemXml =
          stockMatch[0];


        // =================================
        // GET PRODUCT NAME
        // =================================

        const nameMatch =
          stockItemXml.match(
            /<STOCKITEM\b[^>]*\bNAME="([^"]*)"/i
          );


        let productName =
          nameMatch
            ? nameMatch[1]
            : '';


        if (
          !productName
        ) {

          productName =
            getTagValue(
              stockItemXml,
              'NAME'
            );

        }


        if (
          !productName
        ) {

          continue;

        }


        // =================================
        // GST RATES
        // =================================

        let igstRate =
          0;


        let cgstRate =
          0;


        let sgstRate =
          0;


        // =================================
        // IMPORTANT:
        // TALLY RETURNS RATEDETAILS.LIST
        // =================================

        const rateDetailRegex =
          /<RATEDETAILS\.LIST\b[^>]*>[\s\S]*?<\/RATEDETAILS\.LIST>/gi;


        let rateMatch;


        while (

          (
            rateMatch =
            rateDetailRegex.exec(
              stockItemXml
            )
          )
          !== null

        ) {


          const rateXml =
            rateMatch[0];


          const dutyHead =
            String(

              getTagValue(
                rateXml,
                'GSTRATEDUTYHEAD'
              )

              ||

              ''

            )

              .trim()

              .toLowerCase();


          const rateText =
            getTagValue(
              rateXml,
              'GSTRATE'
            );


          const rate =
            Number(
              String(
                rateText ||
                '0'
              ).trim()
            );


          if (

            !Number.isFinite(
              rate
            )

          ) {

            continue;

          }


          // =================================
          // CGST
          // =================================

          if (

            dutyHead.includes(
              'cgst'
            )

            ||

            dutyHead.includes(
              'central'
            )

          ) {

            cgstRate =
              rate;

          }


          // =================================
          // SGST
          // =================================

          else if (

            dutyHead.includes(
              'sgst'
            )

            ||

            dutyHead.includes(
              'state'
            )

            ||

            dutyHead.includes(
              'utgst'
            )

          ) {

            sgstRate =
              rate;

          }


          // =================================
          // IGST
          // =================================

          else if (

            dutyHead.includes(
              'igst'
            )

            ||

            dutyHead.includes(
              'integrated'
            )

          ) {

            igstRate =
              rate;

          }

        }


        // =================================
        // CALCULATE TOTAL GST
        // =================================

        let totalGSTRate =
          0;


        if (

          igstRate > 0

        ) {

          totalGSTRate =
            igstRate;

        }

        else {

          totalGSTRate =
            cgstRate +
            sgstRate;

        }


        // =================================
        // SAVE RATE
        // =================================

        productRates[

          String(
            productName
          )

            .trim()

            .toLowerCase()

        ] =

          totalGSTRate;


        console.log(
          'GST RATE FOUND:'
        );


        console.log(
          'Product:',
          productName
        );


        console.log(
          'CGST:',
          cgstRate + '%'
        );


        console.log(
          'SGST:',
          sgstRate + '%'
        );


        console.log(
          'IGST:',
          igstRate + '%'
        );


        console.log(
          'Total GST:',
          totalGSTRate + '%'
        );

      }


      return productRates;

    }

    // =================================
    // REMOVE GST FROM INCLUSIVE AMOUNT
    // =================================

    function removeGSTFromInclusiveAmount(

      inclusiveAmount,

      gstRate

    ) {

      const gross =
        Number(
          inclusiveAmount
        );


      const taxRate =
        Number(
          gstRate
        );


      // =================================
      // VALIDATE
      // =================================

      if (

        !Number.isFinite(
          gross
        )

        ||

        gross <= 0

      ) {

        return {

          taxableAmount:
            0,

          gstAmount:
            0,

          grossAmount:
            0

        };

      }


      // No GST

      if (

        !Number.isFinite(
          taxRate
        )

        ||

        taxRate <= 0

      ) {

        return {

          taxableAmount:
            gross,

          gstAmount:
            0,

          grossAmount:
            gross

        };

      }


      // =================================
      // REMOVE GST
      //
      // Example:
      //
      // 118 inclusive
      // 18% GST
      //
      // 118 × 100 / 118 = 100
      // =================================

      const taxableAmount =
        gross *

        100 /

        (
          100 +
          taxRate
        );


      const gstAmount =
        gross -
        taxableAmount;


      return {

        taxableAmount:
          taxableAmount,

        gstAmount:
          gstAmount,

        grossAmount:
          gross

      };

    }

    // =================================
    // PREPARE INVOICE ITEMS FOR TALLY
    // =================================

    function prepareInvoiceItemsForTally(

      lineItems,

      productGSTRates,

      gstEnabled

    ) {

      const preparedItems =
        [];


      for (
        const item
        of lineItems
      ) {


        const productName =
          getLineItemProductName(
            item
          );


        if (
          !productName
        ) {

          throw new Error(
            'Product name is missing.'
          );

        }


        // =================================
        // PACK STATUS
        // =================================

        const packStatus =
          Number(
            item.pack_status ||
            0
          );


        let quantity =
          0;


        let unit =
          'Nos';


        // =================================
        // AFTER PACKING
        // =================================

        if (
          packStatus === 1
        ) {

          quantity =
            toNumber(

              item.pack_quantity,

              0

            );


          unit =
            cleanUnit(

              item.pack_unit ||
              item.unit

            );

        }


        // =================================
        // BEFORE PACKING
        // =================================

        else {

          quantity =
            toNumber(

              item.quantity,

              0

            );


          unit =
            cleanUnit(
              item.unit
            );

        }


        if (
          quantity <= 0
        ) {

          throw new Error(

            `Invalid quantity for product: ${productName}`

          );

        }


        // =================================
        // ORIGINAL TOTAL
        //
        // This is the GST-inclusive amount.
        // =================================

        const grossTotal =
          getLineItemTotal(
            item
          );


        if (
          grossTotal < 0
        ) {

          throw new Error(

            `Invalid total for product: ${productName}`

          );

        }


        // =================================
        // GET GST RATE
        // =================================

        const normalizedProductName =
          normalizeName(
            productName
          );


        const gstRate =
          gstEnabled

            ?

            Number(

              productGSTRates[
              normalizedProductName
              ]

              ||

              0

            )

            :

            0;

        const gstRateDecimal =
          gstRate / 100;

        const rawTaxableAmount =
          grossTotal /
          (1 + gstRateDecimal);

        // Round ONLY taxable amount
        const taxableTotal =
          Number(
            rawTaxableAmount.toFixed(2)
          );

        // GST is the remaining amount
        const gstAmount =
          grossTotal -
          taxableTotal;


        // =================================
        // CALCULATE RATE
        //
        // IMPORTANT:
        //
        // Do not use database rate column.
        //
        // Rate = amount / quantity
        // =================================

        const tallyRate =
          taxableTotal /
          quantity;


        preparedItems.push({

          productName:
            productName,

          quantity:
            quantity,

          unit:
            unit,

          grossTotal:
            grossTotal,

          taxableTotal:
            taxableTotal,

          gstAmount:
            gstAmount,

          gstRate:
            gstRate,

          tallyRate:
            tallyRate

        });


      }


      return preparedItems;

    }


    // =================================
    // GENERATE INVOICE IN TALLY
    // =================================

    async function generateInvoiceInTally(
  invoiceData
) {

  try {

    

      // =================================
      // VALIDATE INVOICE DATA
      // =================================

      if (
        !invoiceData
      ) {

        throw new Error(
          'Invoice data is missing.'
        );

      }


      const order =
        invoiceData.order;


      const lineItems =
        invoiceData.line_items;

      // =================================
      // GET GST STATUS
      // =================================

      // Use the GST setting selected
      // in the Tally Bridge Setup window.

      const gstEnabled =
        setupGstEnabled;


      console.log(
        'GST Enabled from Setup:',
        gstEnabled
      );

      let productGSTRates =
        {};


      if (
        gstEnabled
      ) {

        productGSTRates =
          await getTallyProductGSTRates();

      }


      console.log(
        'GST Enabled:',
        gstEnabled
      );


      console.log(
        'Product GST Rates:',
        productGSTRates
      );


      if (
        !order
      ) {

        throw new Error(
          'Order data is missing.'
        );

      }


      if (

        !Array.isArray(
          lineItems
        )

        ||

        lineItems.length === 0

      ) {

        throw new Error(
          'Invoice has no line items.'
        );

      }


      // =================================
      // GET CUSTOMER NAME
      // =================================

      const customerName =
        getInvoiceCustomerName(
          invoiceData
        );


      if (
        !customerName
      ) {

        throw new Error(
          'Could not determine customer name for invoice.'
        );

      }


      // =================================
      // GET SALES LEDGER
      // =================================

      const salesLedger =
        await getSalesLedger();


      if (
        !salesLedger
      ) {

        throw new Error(
          'Could not determine Sales ledger from Tally.'
        );

      }

      const salesVoucherType =
  await getSalesVoucherType();

if (!salesVoucherType) {
  throw new Error(
    'Could not determine Sales Voucher Type from Tally.'
  );
}


      console.log(
        'Using Sales ledger:',
        salesLedger
      );


      // =================================
      // GET VOUCHER DATE
      // =================================

       const voucherDate =
       getInvoiceDate();

     // const voucherDate =
     //   '20260902';


      console.log(
        'Voucher Date:',
        voucherDate
      );


      // =================================
      // CALCULATE TOTAL
      // =================================

      const totalAmount =
        calculateInvoiceTotal(
          lineItems
        );
      const roundedTotal =
        Math.round(totalAmount);

      // =================================
// PREPARE ITEMS FOR TALLY
// =================================

const preparedItems =
  prepareInvoiceItemsForTally(
    lineItems,
    productGSTRates,
    gstEnabled
  );


// =================================
// CALCULATE TOTALS
// =================================

const taxableTotal =
  Number(
    preparedItems.reduce(
      (total, item) =>
        total +
        Number(item.taxableTotal || 0),
      0
    ).toFixed(2)
  );

const totalGST =
  Number(
    preparedItems.reduce(
      (total, item) =>
        total +
        Number(item.gstAmount || 0),
      0
    ).toFixed(2)
  );


// =================================
// SPLIT GST EQUALLY
//
// CGST and SGST MUST BE SAME
// =================================

const cgstTotal =
  Number(
    (totalGST / 2).toFixed(2)
  );

const sgstTotal =
  cgstTotal;


// =================================
// CALCULATE ACTUAL VOUCHER TOTAL
// =================================

const calculatedVoucherTotal =
  Number(
    (
      taxableTotal +
      cgstTotal +
      sgstTotal
    ).toFixed(2)
  );


// =================================
// ROUND OFF
// =================================

const roundOffAmount =
  Number(
    (
      roundedTotal -
      calculatedVoucherTotal
    ).toFixed(2)
  );


// =================================
// DEBUG
// =================================

console.log(
  '[BRIDGE] Taxable Total:',
  taxableTotal
);

console.log(
  '[BRIDGE] Total GST:',
  totalGST
);

console.log(
  '[BRIDGE] CGST Total:',
  cgstTotal
);

console.log(
  '[BRIDGE] SGST Total:',
  sgstTotal
);

console.log(
  '[BRIDGE] Rounded Total:',
  roundedTotal
);

console.log(
  '[BRIDGE] Round Off Amount:',
  roundOffAmount
);


// =================================
// BUILD INVENTORY ENTRIES
// =================================

const inventoryEntries =
  buildInventoryEntries(
    preparedItems,
    salesLedger
  );


// =================================
// BUILD GST ENTRIES
// =================================

const gstLedgerEntries =
  buildGSTLedgerEntries(
    preparedItems
  );


// =================================
// BUILD ROUND OFF ENTRY
// =================================

const roundOffLedgerEntry =
  buildRoundOffLedgerEntry(
    roundOffAmount
  );



      if (
        totalAmount < 0
      ) {

        throw new Error(
          'Invoice total cannot be negative.'
        );

      }




// =================================
// DEBUG TOTALS
// =================================

console.log(
  'Taxable Total:',
  taxableTotal
);

console.log(
  'Total GST:',
  totalGST
);

console.log(
  'CGST Total:',
  cgstTotal
);

console.log(
  'SGST Total:',
  sgstTotal
);

console.log(
  'Rounded Total:',
  roundedTotal
);

console.log(
  'Round Off Amount:',
  roundOffAmount
);

      // =================================
      // LOG INVOICE DETAILS
      // =================================

      console.log('');

      console.log(
        '=========================================='
      );

      console.log(
        'SENDING INVOICE TO TALLY'
      );

      console.log(
        '=========================================='
      );

      console.log(
        'Order ID:',
        order.id
      );

      console.log(
        'Order Number:',
        order.order_number
      );

      console.log(
        'Customer:',
        customerName
      );

      console.log(
        'Sales Ledger:',
        salesLedger
      );

      console.log(
        'Total:',
        totalAmount
      );

      console.log(
        'Items:',
        lineItems.length
      );

      console.log(
        '=========================================='
      );

      console.log('');


      // =================================
      // BUILD TALLY VOUCHER XML
      //
      // IMPORTANT:
      // DATE is placed directly inside
      // VOUCHER.
      // =================================

      const xml = `

<ENVELOPE>

  <HEADER>

    <VERSION>
      1
    </VERSION>

    <TALLYREQUEST>
      IMPORT
    </TALLYREQUEST>

    <TYPE>
      DATA
    </TYPE>

    <ID>
      Vouchers
    </ID>

  </HEADER>


  <BODY>

    <DESC>

      <STATICVARIABLES>

        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>

      </STATICVARIABLES>

    </DESC>


    <DATA>

      <TALLYMESSAGE
        xmlns:UDF="TallyUDF"
      >

        <VOUCHER
  VCHTYPE="${escapeXml(salesVoucherType)}"
  ACTION="Create"
  OBJVIEW="Invoice Voucher View"
>
  <ISINVOICE>Yes</ISINVOICE>


          <DATE>
            ${voucherDate}
          </DATE>


          <VOUCHERTYPENAME>
            ${escapeXml(salesVoucherType)}
          </VOUCHERTYPENAME>


          <PARTYLEDGERNAME>
            ${escapeXml(customerName)}
          </PARTYLEDGERNAME>


          <PERSISTEDVIEW>
            Invoice Voucher View
          </PERSISTEDVIEW>


          <!-- ========================= -->
          <!-- CUSTOMER / PARTY ENTRY -->
          <!-- ========================= -->

          <LEDGERENTRIES.LIST>


            <LEDGERNAME>
              ${escapeXml(customerName)}
            </LEDGERNAME>


            <ISDEEMEDPOSITIVE>
              Yes
            </ISDEEMEDPOSITIVE>


            <AMOUNT>
              -${formatAmount(roundedTotal)}
            </AMOUNT>


          </LEDGERENTRIES.LIST>


          <!-- ========================= -->
          <!-- PRODUCT ENTRIES -->
          <!-- ========================= -->

          ${inventoryEntries}

          ${gstLedgerEntries}

          ${roundOffLedgerEntry}


        </VOUCHER>


      </TALLYMESSAGE>


    </DATA>


  </BODY>


</ENVELOPE>

`;


      // =================================
      // SHOW FINAL XML
      // =================================

      console.log('');

      console.log(
        '=========================================='
      );

      console.log(
        'FINAL INVOICE XML'
      );

      console.log(
        '=========================================='
      );

      console.log(
        xml
      );

      console.log(
        '=========================================='
      );

      console.log('');


      // =================================
      // SEND TO TALLY
      // =================================

      const result =
        await postToTally(
          xml
        );


      if (
        !result.success
      ) {

        throw new Error(
          result.error ||
          'Could not send invoice to Tally.'
        );

      }


      const response =
        String(
          result.data ||
          ''
        );


      // =================================
      // SHOW RAW RESPONSE
      // =================================

      console.log('');

      console.log(
        'RAW TALLY RESPONSE:'
      );

      console.log(
        response
      );

      console.log('');


      // =================================
      // PARSE RESPONSE
      // =================================

      const created =
        Number(
          getTagValue(
            response,
            'CREATED'
          ) || 0
        );


      const altered =
        Number(
          getTagValue(
            response,
            'ALTERED'
          ) || 0
        );


      const errors =
        Number(
          getTagValue(
            response,
            'ERRORS'
          ) || 0
        );


      const exceptions =
        Number(
          getTagValue(
            response,
            'EXCEPTIONS'
          ) || 0
        );


      const lineError =
        getTagValue(
          response,
          'LINEERROR'
        );


      const exceptionError =
        getTagValue(
          response,
          'EXCEPTION'
        );


      console.log(
        'LINE ERROR:',
        lineError
      );

      console.log(
        'EXCEPTION ERROR:',
        exceptionError
      );


      // =================================
      // SHOW RESULT
      // =================================

      console.log('');

      console.log(
        'TALLY INVOICE RESPONSE'
      );

      console.log(
        'CREATED:',
        created
      );

      console.log(
        'ALTERED:',
        altered
      );

      console.log(
        'ERRORS:',
        errors
      );

      console.log(
        'EXCEPTIONS:',
        exceptions
      );

      console.log('');


      // =================================
      // CHECK SUCCESS
      // =================================

      if (
        created < 1
      ) {

        throw new Error(

          lineError ||

          'Tally did not create the invoice.'

        );

      }


      // =================================
      // SUCCESS
      // =================================

      console.log('');

      console.log(
        '=========================================='
      );

      console.log(
        'INVOICE GENERATED SUCCESSFULLY'
      );

      console.log(
        '=========================================='
      );

      console.log(
        'Order Number:',
        order.order_number
      );

      console.log(
        'Customer:',
        customerName
      );

      console.log(
        'Amount:',
        totalAmount
      );

      console.log(
        '=========================================='
      );

      console.log('');


      return {

        success:
          true,

        order_id:
          order.id,

        order_number:
          order.order_number,

        created:
          created,

        altered:
          altered,

        response:
          response

         };

    } catch (error) {

      console.error('');
      console.error(
        '=========================================='
      );

      console.error(
        'INVOICE PROCESSING ERROR'
      );

      console.error(
        '=========================================='
      );

      console.error(
        error.message || error
      );

      console.error(
        '=========================================='
      );

      console.error('');

      return {
        success: false,
        error: error.message || String(error)
      };

    }

  }


    // =================================
    // MARK INVOICE AS GENERATED
    async function markInvoiceGenerated(
      orderId,
      requestId
    ) {

      try {

        console.log(
          'Marking invoice as generated...'
        );


        const response =
          await axios.post(

            invoiceEdgeFunctionUrl,

            {

              action:
                'mark_invoice_generated',

              bridge_secret:
                bridgeSecret,

              order_id:
                orderId,

              request_id:
                requestId

            },

            {

              headers: {

                'Content-Type':
                  'application/json',

                'Authorization':
                  `Bearer ${supabaseAnonKey}`,

                'x-tally-bridge-secret':
                  bridgeSecret

              },

              timeout:
                30000

            }

          );


        console.log(
          'Invoice status update response:',
          response.data
        );


        if (
          !response.data ||
          response.data.success !== true
        ) {

          throw new Error(
            response.data?.error ||
            'Server did not confirm invoice completion.'
          );

        }


        return true;


      } catch (
      error
      ) {

        console.error(
          'Could not mark invoice as generated.'
        );


        if (
          error.response
        ) {

          console.error(
            'Status:',
            error.response.status
          );


          console.error(
            'Response:',
            error.response.data
          );

        } else {

          console.error(
            error.message
          );

        }


        return false;

      }

    }

    // =================================
// MARK INVOICE AS FAILED
// =================================

async function markInvoiceFailed(
  requestId,
  errorMessage
) {

  try {

    console.log(
      'Marking invoice as failed...'
    );


    const response =
      await axios.post(

        invoiceEdgeFunctionUrl,

        {

          action:
            'mark_invoice_failed',

          bridge_secret:
            bridgeSecret,

          request_id:
            requestId,

          error_message:
            errorMessage

        },

        {

          headers: {

            'Content-Type':
              'application/json',

            'Authorization':
              `Bearer ${supabaseAnonKey}`,

            'x-tally-bridge-secret':
              bridgeSecret

          },

          timeout:
            30000

        }

      );


    if (
      !response.data ||
      response.data.success !== true
    ) {

      throw new Error(
        response.data?.error ||
        'Server did not confirm invoice failure.'
      );

    }


    console.log(
      'Invoice marked as failed successfully.'
    );


    return true;


  } catch (
    error
  ) {

    console.error(
      'Could not mark invoice as failed.'
    );


    if (
      error.response
    ) {

      console.error(
        'Status:',
        error.response.status
      );

      console.error(
        'Response:',
        error.response.data
      );

    } else {

      console.error(
        error.message
      );

    }


    return false;

  }

}

    // =================================
    // GET PENDING INVOICE
    // =================================

    async function getPendingInvoice() {

      try {

        console.log(
          'Checking server for pending invoice...'
        );

        const response =
          await axios.post(

            invoiceEdgeFunctionUrl,

            {
              action:
                'get_pending_invoice',

              bridge_secret:
                bridgeSecret
            },

            {
              headers: {

                'Content-Type':
                  'application/json',

                'Authorization':
                  `Bearer ${supabaseAnonKey}`,

                'x-tally-bridge-secret':
                  bridgeSecret

              },

              timeout:
                30000

            }

          );

        return response.data;

        console.log('');
        console.log('FULL INVOICE DATA:');
        console.log(
          JSON.stringify(
            response.data,
            null,
            2
          )
        );
        console.log('');

      } catch (
      error
      ) {

        console.error(
          'Could not check pending invoice.',
          error
        );

        console.error(
          'Error message:',
          error.message
        );

        console.error(
          'Invoice Edge Function URL:',
          invoiceEdgeFunctionUrl
        );;

        if (
          error.response
        ) {

          console.error(
            'Status:',
            error.response.status
          );

          console.error(
            'Response:',
            error.response.data
          );

        } else {

          console.error(
            error.message
          );

        }

        return null;

      }

    }

    // =================================
    // PROCESS ONE PENDING INVOICE
    // =================================

    async function processPendingInvoice() {

        let currentRequestId = null;

        let currentOrderId = null;

      try {

        console.log('');

        console.log(
          '=========================================='
        );

        console.log(
          'CHECKING FOR PENDING INVOICE'
        );

        console.log(
          '=========================================='
        );


        // -------------------------------
        // GET PENDING INVOICE
        // -------------------------------

        const invoiceData =
          await getPendingInvoice();


        if (
  !invoiceData
) {

  throw new Error(
    'Could not get invoice data from the server.'
  );

}


        // -------------------------------
        // CHECK SERVER SUCCESS
        // -------------------------------

        if (
  invoiceData.success !== true
) {

  throw new Error(
    invoiceData.error ||
    invoiceData.message ||
    'Invoice request failed.'
  );

}


        // -------------------------------
        // NO PENDING INVOICE
        // -------------------------------

        if (
          invoiceData.pending !== true
        ) {

          console.log(
            'No pending invoice.'
          );

          return;

        }




        currentRequestId =
  invoiceData.request_id;


// -------------------------------
// VALIDATE ORDER
// -------------------------------

if (
  !invoiceData.order
) {

  throw new Error(
    'Pending invoice has no order data.'
  );

}


const order =
  invoiceData.order;


currentOrderId =
  order.id;

        

        console.log(
          'FULL INVOICE DATA:'
        );

        console.log(
          JSON.stringify(
            invoiceData,
            null,
            2
          )
        );


        console.log('');

        console.log(
          'Pending invoice found.'
        );

        console.log(
          'Order ID:',
          order.id
        );

        console.log(
          'Order Number:',
          order.order_number
        );


        // -------------------------------
        // GENERATE IN TALLY
        // -------------------------------

        const tallyResult =
          await generateInvoiceInTally(
            invoiceData
          );


        if (
  !tallyResult ||
  tallyResult.success !== true
) {

  throw new Error(
    tallyResult?.error ||
    'Invoice was not generated in Tally.'
  );

}


        // -------------------------------
        // MARK AS GENERATED ON SERVER
        //
        // IMPORTANT:
        // This happens ONLY AFTER
        // Tally successfully creates it.
        // -------------------------------


        const marked =
          await markInvoiceGenerated(
            order.id,
            invoiceData.request_id
          );


        if (
          !marked
        ) {

          console.error('');

          console.error(
            '=========================================='
          );

          console.error(
            'WARNING'
          );

          console.error(
            '=========================================='
          );

          console.error(
            'Invoice was created in Tally,'
          );

          console.error(
            'but the server could not mark it'
          );

          console.error(
            'as generated.'
          );

          console.error('');

          console.error(
            'DO NOT manually generate this'
          );

          console.error(
            'invoice again until the server'
          );

          console.error(
            'status is checked.'
          );

          console.error('');

          return;

        }


        // -------------------------------
        // COMPLETE
        // -------------------------------

        console.log('');

        console.log(
          '=========================================='
        );

        console.log(
          'INVOICE PROCESS COMPLETED'
        );

        console.log(
          '=========================================='
        );

        console.log(
          'Order:',
          order.order_number
        );

        console.log(
          'Status: Generated and confirmed'
        );

        console.log(
          '=========================================='
        );

        console.log('');


            } catch (
        error
      ) {

        console.error('');

        console.error(
          '=========================================='
        );

        console.error(
          'INVOICE PROCESSING ERROR'
        );

        console.error(
          '=========================================='
        );


        const errorMessage =
          error?.response?.data?.error ||
          error?.message ||
          String(error) ||
          'Unknown invoice processing error.';


        console.error(
          errorMessage
        );

        console.error(
          '=========================================='
        );

        console.error('');


        // =================================
        // SAVE ERROR TO SUPABASE
        // =================================

        if (
          currentRequestId
        ) {

          console.log(
            'Saving invoice error to server...'
          );


          try {

            await markInvoiceFailed(
              currentRequestId,
              errorMessage
            );

          } catch (
            saveError
          ) {

            console.error(
              'Could not save invoice error:',
              saveError.message
            );

          }

        } else {

          console.error(
            'No request ID available. Cannot save error.'
          );

        }


        return {

          success:
            false,

          error:
            errorMessage

        };

      }

    } // closes processPendingInvoice


    // =================================
    // START TALLY BRIDGE SERVICES
    // =================================

    async function startTallyBridge() {

      console.log('');

      console.log(
        'Starting Tally Bridge services...'
      );

      console.log('');





      // =================================
      // CHECK PENDING INVOICE
      // =================================

      await processPendingInvoice();

    }



  // =================================
// START APPLICATION
// =================================

startTallyBridge()

  .then(

    () => {

      startInvoiceRealtimeListener();

    }

  )

  .catch(

    error => {

      console.error('');

      console.error(
        '=========================================='
      );

      console.error(
        'TALLY BRIDGE STARTUP ERROR'
      );

      console.error(
        '=========================================='
      );

      console.error(
        error
      );

      console.error(
        '=========================================='
      );

      process.exit(
        1
      );

    }

  );



    // ===========================================
// SUPABASE REALTIME INVOICE LISTENER
// ===========================================

function startInvoiceRealtimeListener() {

  console.log('');
  console.log('==========================================');
  console.log('STARTING INVOICE REALTIME LISTENER');
  console.log('==========================================');

  const channel =
    supabase.channel(
      'invoice-requests-realtime-' +
      Date.now()
    );


  channel.on(

    'postgres_changes',

    {
      event: '*',
      schema: 'public',
      table: 'invoice_requests'
    },

    async (payload) => {

      console.log('');
      console.log('==========================================');
      console.log('REALTIME EVENT RECEIVED');
      console.log('==========================================');

      console.log(
        JSON.stringify(
          payload,
          null,
          2
        )
      );

      console.log('==========================================');


      // Only process new pending invoices
      if (
        payload.eventType !== 'INSERT'
      ) {

        console.log(
          '[BRIDGE] Ignoring non-INSERT event:',
          payload.eventType
        );

        return;

      }


      if (
        !payload.new
      ) {

        console.log(
          '[BRIDGE] No new data received.'
        );

        return;

      }


      if (
        payload.new.status !== 'pending'
      ) {

        console.log(
          '[BRIDGE] New request is not pending.'
        );

        console.log(
          'Status:',
          payload.new.status
        );

        return;

      }


      console.log('');
      console.log('==========================================');
      console.log('STARTING AUTOMATIC INVOICE PROCESSING');
      console.log('==========================================');

      console.log(
        '[BRIDGE] Request ID:',
        payload.new.id
      );

      console.log(
        '[BRIDGE] Order ID:',
        payload.new.order_id
      );

      console.log(
        '[BRIDGE] Company ID:',
        payload.new.company_id
      );


      try {

        await processPendingInvoice();


        console.log('');
        console.log('==========================================');
        console.log('AUTOMATIC INVOICE PROCESSING FINISHED');
        console.log('==========================================');

      } catch (error) {

        console.error('');

        console.error(
          'REALTIME INVOICE ERROR:'
        );

        console.error(
          error.message || error
        );

      }

    }

  );


  channel.subscribe(

    (status, error) => {

      console.log(
        '[BRIDGE] Invoice Realtime status:',
        status
      );


      if (error) {

        console.error(
          '[BRIDGE] Invoice Realtime error:',
          error
        );

      }


      if (
        status === 'SUBSCRIBED'
      ) {

        console.log(
          '[BRIDGE] REALTIME LISTENER IS READY'
        );

      }

    }

  );

}