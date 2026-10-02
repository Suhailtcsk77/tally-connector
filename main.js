const {
  app,
  Tray,
  Menu,
  nativeImage,
  BrowserWindow,
  ipcMain
} = require('electron');

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');


// =================================
// CONFIGURATION
// =================================

const ACTIVATION_FUNCTION_URL =
  'https://retqsjcduyobpazqaoce.supabase.co/functions/v1/activate-tally-bridge';






const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldHFzamNkdXlvYnBhenFhb2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzI1NzksImV4cCI6MjA3OTAwODU3OX0.GjgHFbhNo8x17ZSIheanP2d_0ouUbFlh6MK2iatbqVE';


// =================================
// GLOBAL VARIABLES
// =================================

let tray = null;

let bridgeProcess = null;

let productSyncRunning = false;
let productSyncEnabled = true;
let syncProductsAfterSetup = false;
let syncCustomersAfterSetup = false;
let customerSyncRunning = false;
let bridgeStdoutBuffer = '';

let activationWindow = null;

let setupWindow = null;

let isQuitting = false;


// =================================
// ALLOW ONLY ONE APP INSTANCE
// =================================

const gotTheLock =
  app.requestSingleInstanceLock();


if (!gotTheLock) {

  app.quit();

} else {

  app.on(
    'second-instance',
    () => {

      if (activationWindow) {

        activationWindow.focus();

      }

      if (tray) {

        tray.displayBalloon({

          title:
            'Tally Bridge',

          content:
            'Tally Bridge is already running.'

        });

      }

    }
  );

}


// =================================
// APP DATA DIRECTORY
// =================================

function getBridgeDirectory() {

  const appDataPath =
    app.getPath(
      'appData'
    );


  const bridgeDirectory =
    path.join(
      appDataPath,
      'Tally Bridge'
    );


  if (
    !fs.existsSync(
      bridgeDirectory
    )
  ) {

    fs.mkdirSync(
      bridgeDirectory,
      {
        recursive:
          true
      }
    );

  }


  return bridgeDirectory;

}


// =================================
// ENV FILE PATH
// =================================

function getEnvPath() {

  return path.join(
    getBridgeDirectory(),
    '.env'
  );

}

const SUPPORT_LOG_RETENTION_DAYS = 14;
const SUPPORT_LOG_MAX_BYTES = 5 * 1024 * 1024;

let lastSupportLogCleanupDate = null;

function getSupportLogDirectory() {
  const logDirectory = path.join(
    getBridgeDirectory(),
    'logs'
  );

  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, {
      recursive: true
    });
  }

  return logDirectory;
}

function cleanupOldSupportLogs() {
  const logDirectory = getSupportLogDirectory();

  const cutoffTime =
    Date.now() -
    SUPPORT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const logFiles = fs.readdirSync(logDirectory);

  for (const fileName of logFiles) {
    if (
      !/^bridge-\d{4}-\d{2}-\d{2}(?:-\d+)?\.log$/i.test(fileName)
    ) {
      continue;
    }

    const filePath = path.join(
      logDirectory,
      fileName
    );

    try {
      const stats = fs.statSync(filePath);

      if (
        stats.isFile() &&
        stats.mtimeMs < cutoffTime
      ) {
        fs.unlinkSync(filePath);

        console.log(
          '[SUPPORT LOG] Removed old log:',
          fileName
        );
      }
    } catch (error) {
      console.error(
        '[SUPPORT LOG] Could not clean up log:',
        fileName,
        error.message
      );
    }
  }
}

function writeSupportLog(level, message) {
  try {
    const logDirectory = getSupportLogDirectory();
    const now = new Date();

    const dateTag = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');

    // Clean old files once per calendar day.
    if (lastSupportLogCleanupDate !== dateTag) {
      cleanupOldSupportLogs();
      lastSupportLogCleanupDate = dateTag;
    }

    let safeMessage = String(message ?? '')
      .replace(/\u0000/g, '')
      .replace(
        /("(?:bridge_secret|supabase_anon_key|supabase_service_role_key|authorization|apikey)"\s*:\s*")[^"]*"/gi,
        '$1[REDACTED]"'
      )
      .slice(0, 50000);

    const logLine =
      `${now.toISOString()} [${level}] ${safeMessage}\n`;

    // Use another file if today's file reaches 5 MB.
    let part = 1;
    let logPath;

    while (true) {
      const suffix = part === 1 ? '' : `-${part}`;

      logPath = path.join(
        logDirectory,
        `bridge-${dateTag}${suffix}.log`
      );

      let fileSize = 0;

      try {
        fileSize = fs.statSync(logPath).size;
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      if (fileSize < SUPPORT_LOG_MAX_BYTES) {
        break;
      }

      part++;
    }

    fs.appendFileSync(
      logPath,
      logLine,
      'utf8'
    );
  } catch (error) {
    console.error(
      '[SUPPORT LOG ERROR]',
      error.message
    );
  }
}

// Capture application errors in the support log.
let supportConsoleCaptureBusy = false;

const originalConsoleError = console.error.bind(console);

console.error = (...args) => {
  // Keep showing errors in the existing console.
  originalConsoleError(...args);

  // Prevent recursive logging if the logger itself fails.
  if (supportConsoleCaptureBusy) {
    return;
  }

  supportConsoleCaptureBusy = true;

  try {
    const message = args.map(value => {
      if (value instanceof Error) {
        return (
          `${value.name}: ${value.message}` +
          (value.stack ? `\n${value.stack}` : '')
        );
      }

      if (typeof value === 'string') {
        return value;
      }

      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }).join(' ');

    writeSupportLog('ERROR', message);
  } catch (error) {
    originalConsoleError(
      '[SUPPORT LOG ERROR]',
      error.message
    );
  } finally {
    supportConsoleCaptureBusy = false;
  }
};

// Record unexpected application errors.
process.on('uncaughtException', (error) => {
  writeSupportLog(
    'FATAL',
    `${error.name}: ${error.message}\n${error.stack || ''}`
  );

  originalConsoleError(
    '[FATAL] Application error:',
    error
  );

  app.exit(1);
});

// Record promises that fail without an error handler.
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error
    ? `${reason.name}: ${reason.message}\n${reason.stack || ''}`
    : String(reason);

  writeSupportLog('ERROR', `Unhandled promise rejection: ${message}`);

  originalConsoleError(
    '[UNHANDLED PROMISE REJECTION]',
    reason
  );
});

// =================================
// CHECK ACTIVATION
// =================================

function isActivated() {

  const envPath =
    getEnvPath();


  if (
    !fs.existsSync(
      envPath
    )
  ) {

    return false;

  }


  try {

    const envContent =
      fs.readFileSync(
        envPath,
        'utf8'
      );


    const secretMatch =
      envContent.match(
        /^TALLY_BRIDGE_SECRET=(.+)$/m
      );


    if (
      !secretMatch
    ) {

      return false;

    }


    const bridgeSecret =
      secretMatch[1]
        .trim();


    return (
      bridgeSecret.length > 0
    );


  } catch (error) {

    console.error(
      'Could not read activation configuration:',
      error.message
    );


    return false;

  }

}


// =================================
// CHECK TALLY SETUP
// =================================

function isTallySetupComplete() {

  const envPath =
    getEnvPath();


  if (
    !fs.existsSync(
      envPath
    )
  ) {

    return false;

  }


  try {

    const envContent =
      fs.readFileSync(

        envPath,

        'utf8'

      );


    const tallyCompanyMatch =
      envContent.match(
        /^TALLY_COMPANY=(.+)$/m
      );


    if (
      !tallyCompanyMatch
    ) {

      return false;

    }


    const tallyCompany =
      tallyCompanyMatch[1]
        .trim();


    return (
      tallyCompany.length > 0
    );


  } catch (error) {

    console.error(

      'Could not read Tally setup:',

      error.message

    );


    return false;

  }

}

// =================================
// SAVE BRIDGE CONFIGURATION
// =================================


function saveBridgeSecret(
  bridgeSecret,
  companyId,
  companyGst
) {
  const envPath = getEnvPath();

  const envContent = `SUPABASE_URL=https://retqsjcduyobpazqaoce.supabase.co
INVOICE_EDGE_FUNCTION_URL=https://retqsjcduyobpazqaoce.supabase.co/functions/v1/tally-bridge-invoice
TALLY_BRIDGE_SECRET=${bridgeSecret}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
TALLY_COMPANY_ID=${companyId}
TALLY_COMPANY_GST=${companyGst ? 'true' : 'false'}
`;

  fs.writeFileSync(
    envPath,
    envContent,
    'utf8'
  );

  console.log(
    'Bridge configuration saved successfully.'
  );

  console.log(
    'Configuration path:',
    envPath
  );
}


// =================================
// ICON PATH
// =================================

const iconPath =
  path.join(
    __dirname,
    'tally-bridge-icon.ico'
  );


// =================================
// WINDOWS AUTO START
// =================================

function enableAutoStart() {

  if (
    process.platform !== 'win32'
  ) {

    return;

  }


  try {

    app.setLoginItemSettings({

      openAtLogin:
        true,

      openAsHidden:
        true

    });


    console.log(
      'Windows auto-start enabled.'
    );


  } catch (error) {

    console.error(
      'Could not enable Windows auto-start:',
      error.message
    );

  }

}


// =================================
// SHOW ACTIVATION WINDOW
// =================================

function showActivationWindow() {

  if (
    activationWindow
  ) {

    activationWindow.focus();

    return;

  }


  activationWindow =
    new BrowserWindow({

      width:
        450,

      height:
        380,

      resizable:
        false,

      maximizable:
        false,

      minimizable:
        false,

      title:
        'Tally Bridge Setup',

      icon:
        iconPath,

      webPreferences: {

        preload:
          path.join(
            __dirname,
            'preload.js'
          ),

        contextIsolation:
          true,

        nodeIntegration:
          false

      }

    });


  activationWindow.loadFile(

    path.join(
      __dirname,
      'activation.html'
    )

  );


  activationWindow.on(

    'closed',

    () => {

      activationWindow =
        null;

    }

  );

}


// =================================
// SHOW SETUP WINDOW
// =================================

function showSetupWindow() {

  if (
    setupWindow
  ) {

    setupWindow.focus();

    return;

  }


  setupWindow =
    new BrowserWindow({

      width:
        1200,

      height:
        800,

      minWidth:
        900,

      minHeight:
        600,

      webPreferences: {

        preload:
          path.join(
            __dirname,
            'preload.js'
          ),

        contextIsolation:
          true,

        nodeIntegration:
          false

      }

    });


  setupWindow.maximize();


  setupWindow.loadFile(

    path.join(
      __dirname,
      'setup.html'
    )

  );


  setupWindow.on(

    'closed',

    () => {

      setupWindow =
        null;

    }

  );

}


// =================================
// ACTIVATE BRIDGE
// =================================

ipcMain.handle(

  'activate-bridge',

  async (
    event,
    activationCode
  ) => {

    try {

      const cleanCode =
        String(
          activationCode || ''
        )
          .trim();


      if (
        !cleanCode
      ) {

        return {

          success:
            false,

          error:
            'Please enter an activation code.'

        };

      }


      console.log(
        'Sending activation request...'
      );


      const response =
        await fetch(

          ACTIVATION_FUNCTION_URL,

          {

            method:
              'POST',

            headers: {

              'Content-Type':
                'application/json',

              'Authorization':
                `Bearer ${SUPABASE_ANON_KEY}`

            },

            body:
              JSON.stringify({

                activation_code:
                  cleanCode

              })

          }

        );


      let result;


      try {

        result =
          await response.json();

      } catch (error) {

        return {

          success:
            false,

          error:
            'Invalid response from activation server.'

        };

      }


      if (

        !response.ok

        ||

        !result.success

      ) {

        return {

          success:
            false,

          error:

            result.error

            ||

            result.message

            ||

            'Activation failed.'

        };

      }


      if (
        !result.bridge_secret
      ) {

        return {

          success:
            false,

          error:
            'Activation server did not return a bridge secret.'

        };

      }

      
if (
  !result.company_id ||
  typeof result.company_gst !== 'boolean'
) {
  return {
    success: false,
    error:
      'Activation response is missing company GST settings.'
  };
}

saveBridgeSecret(
  result.bridge_secret,
  result.company_id,
  result.company_gst
);




      console.log(
        'Tally Bridge activated successfully.'
      );


      showSetupWindow();


      return {

        success:
          true

      };


    } catch (error) {

      console.error(
        'Activation error:',
        error
      );


      return {

        success:
          false,

        error:

          error.message

          ||

          'Could not connect to activation server.'

      };

    }

  }

);


function escapeTallyPreviewXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeTallyPreviewXml(value) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function cleanTallyPreviewText(value) {
  const cleaned = String(value ?? '')
    .replace(/^[\u0000-\u001F\u007F]+/, '')
    .trim()
    .replace(/\s+/g, ' ');

  const defaults = [
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
    defaults.includes(cleaned.toLowerCase())
  ) {
    return '';
  }

  return cleaned;
}

function getTallyPreviewTag(xml, tagName) {
  const regex = new RegExp(
    '<' + tagName +
    '(?![\\w.])(?:\\s[^>]*)?>' +
    '([\\s\\S]*?)' +
    '<\\/' + tagName +
    '(?![\\w.])\\s*>',
    'i'
  );

  const match = String(xml ?? '').match(regex);

  if (!match) return '';

  return decodeTallyPreviewXml(
    match[1].replace(/<[^>]+>/g, ' ').trim()
  );
}

function getTallyPreviewRows(xml, itemTag) {
  const regex = new RegExp(
    '<' + itemTag + '(?=[\\s>])[^>]*>' +
    '[\\s\\S]*?<\\/' + itemTag + '>',
    'gi'
  );

  return String(xml ?? '').match(regex) || [];
}

function getTallyPreviewName(itemXml, itemTag) {
  const startTag = itemXml.match(
    new RegExp(
      '<' + itemTag + '(?=[\\s>])[^>]*>',
      'i'
    )
  )?.[0] || '';

  const attribute = startTag.match(/\bNAME="([^"]*)"/i);

  return decodeTallyPreviewXml(
    attribute
      ? attribute[1]
      : getTallyPreviewTag(itemXml, 'NAME')
  );
}

async function requestTallyPreview(xml) {
  const response = await fetch(
    'http://127.0.0.1:9000',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      },
      body: xml,
      signal: AbortSignal.timeout(30000)
    }
  );

  const responseXml = await response.text();

  if (!response.ok) {
    throw new Error(
      `Tally returned HTTP ${response.status}.`
    );
  }

  const tallyError = getTallyPreviewTag(
    responseXml,
    'LINEERROR'
  );

  if (tallyError) {
    throw new Error('Tally error: ' + tallyError);
  }

  return responseXml;
}

// ========================================
// PREVIEW 10 PRODUCTS
// ========================================

ipcMain.handle(
  'preview-tally-products',
  async (event, previewData = {}) => {
    try {
      const companyName = String(
        previewData.companyName || ''
      ).trim();

      const fallbackUnit =
  String(previewData.defaultProductUnit || '').trim() || 'Nos';

      if (!companyName) {
        return {
          success: false,
          error: 'Enter the Tally company name first.'
        };
      }

      const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>EXPORT</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>TallyBridgePreviewStockItems</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${escapeTallyPreviewXml(companyName)}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="TallyBridgePreviewStockItems">
            <TYPE>StockItem</TYPE>
            <FETCH>Name</FETCH>
            <FETCH>Parent</FETCH>
            <FETCH>BaseUnits</FETCH>
            <FETCH>PartNo</FETCH>
            <FETCH>Category</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

      const responseXml =
        await requestTallyPreview(xml);

      const items = getTallyPreviewRows(
        responseXml,
        'STOCKITEM'
      );

      const rows = items
        .map(itemXml => ({
          product_name:
            getTallyPreviewName(itemXml, 'STOCKITEM'),
          category:
  cleanTallyPreviewText(
    getTallyPreviewTag(itemXml, 'PARENT')
  ),
          unit: (() => {
  const rawUnit = String(
    getTallyPreviewTag(itemXml, 'BASEUNITS') || ''
  )
    .replace(/^[\u0000-\u001F\u007F]+/, '')
    .trim();

  if (
    !rawUnit ||
    /^(not applicable|not set|none|nil|default)$/i.test(rawUnit)
  ) {
    return fallbackUnit;
  }

  return rawUnit;
})(),
          product_code:
  cleanTallyPreviewText(
    getTallyPreviewTag(itemXml, 'PARTNO')
  )
        }))
        .filter(row => row.product_name)
        .slice(0, 10);

      console.log(
        `[PREVIEW] Returning ${rows.length} product rows.`
      );

      return {
        success: true,
        rows,
        shown: rows.length
      };

    } catch (error) {
      console.error(
        '[PRODUCT PREVIEW ERROR]',
        error.message
      );

      return {
        success: false,
        error: error.message
      };
    }
  }
);

// ========================================
// PREVIEW 10 CUSTOMERS
// ========================================

ipcMain.handle(
  'preview-tally-customers',
  async (event, previewData = {}) => {
    try {
      const companyName = String(
        previewData.companyName || ''
      ).trim();

      if (!companyName) {
        return {
          success: false,
          error: 'Enter the Tally company name first.'
        };
      }

      const fallbackPrice = String(
        previewData.highestPriceLevel || ''
      ).trim();

    const fallbackArea =
  String(previewData.defaultCustomerArea || '').trim() || 'Shop';

 

      const xml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>EXPORT</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>TallyBridgePreviewCustomers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>${escapeTallyPreviewXml(companyName)}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="TallyBridgePreviewCustomers">
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

      const responseXml =
        await requestTallyPreview(xml);

      const ledgers = getTallyPreviewRows(
        responseXml,
        'LEDGER'
      );

      const rows = ledgers
        .map(itemXml => {
          const customerName = cleanTallyPreviewText(
  getTallyPreviewName(itemXml, 'LEDGER')
);

          const parentGroup = cleanTallyPreviewText(
  getTallyPreviewTag(itemXml, 'PARENT')
);

          const addressBlock = itemXml.match(
            /<ADDRESS\.LIST\b[^>]*>([\s\S]*?)<\/ADDRESS\.LIST>/i
          )?.[1] || '';

          const addressParts = [
            ...addressBlock.matchAll(
              /<ADDRESS(?![\w.])[^>]*>([\s\S]*?)<\/ADDRESS>/gi
            )
          ]
            .map(match =>
              decodeTallyPreviewXml(
                match[1].replace(/<[^>]+>/g, ' ').trim()
              )
            )
            .filter(Boolean);

          const rawPriceLevel = [
            getTallyPreviewTag(
              itemXml,
              'PRICELEVELAPPLICABLE'
            ),
            getTallyPreviewTag(itemXml, 'PRICELEVEL'),
            getTallyPreviewTag(itemXml, 'PRICELEVEL.LIST')
          ]
            .map(cleanTallyPreviewText)
            .find(value =>
              value &&
              !/^(not applicable|not set|none|nil|default)$/i.test(value)
            );

          const rawPhone = [
            getTallyPreviewTag(itemXml, 'LEDGERMOBILE'),
            getTallyPreviewTag(itemXml, 'MOBILENUMBER'),
            getTallyPreviewTag(itemXml, 'LEDGERPHONE'),
            getTallyPreviewTag(itemXml, 'PHONENUMBER')
          ]
            .map(cleanTallyPreviewText)
            .find(value =>
              value &&
              !/^(not applicable|not set|none|nil|default)$/i.test(value)
            ) || '';

          const rawBalance = getTallyPreviewTag(
            itemXml,
            'CLOSINGBALANCE'
          );

          const balanceMatch = String(rawBalance || '')
            .replace(/,/g, '')
            .match(/-?\d+(?:\.\d+)?/);

          let balance = balanceMatch
            ? Number(balanceMatch[0])
            : 0;

          if (/\bCR\b/i.test(rawBalance)) {
            balance = -Math.abs(balance);
          } else if (/\bDR\b/i.test(rawBalance)) {
            balance = Math.abs(balance);
          }

          const usablePrice =
            rawPriceLevel || fallbackPrice || 'Price';

          const beat =
            !parentGroup ||
            /^sundry debtors$/i.test(parentGroup) ||
            /^(not applicable|not set|none|nil|default)$/i.test(parentGroup)
              ? 'Shop'
              : parentGroup;

          return {
            customer_name: customerName,
            beat,
            price: usablePrice,
            mobile: rawPhone,
            place: addressParts.join(', '),
            balance
          };
        })
        .filter(row => row.customer_name)
        .slice(0, 10);

      console.log(
        `[PREVIEW] Returning ${rows.length} customer rows.`
      );

      return {
        success: true,
        rows,
        shown: rows.length
      };

    } catch (error) {
      console.error(
        '[CUSTOMER PREVIEW ERROR]',
        error.message
      );

      return {
        success: false,
        error: error.message
      };
    }
  }
);


// =================================
// SAVE TALLY SETUP
// =================================

ipcMain.handle(

  'save-tally-setup',

  async (
    event,
    setupData
  ) => {

    try {

      console.log(
        'Saving Tally setup...'
      );


      // =================================
      // GET SETUP DATA
      // IMPORTANT:
      // ALL VARIABLES ARE DECLARED HERE
      // BEFORE THEY ARE USED.
      // =================================

      const tallyHost =
        '127.0.0.1';


      const tallyPort =
        '9000';


      const tallyCompany =
        String(
          setupData.companyName || ''
        ).trim();


      const gstEnabled =
        setupData.gstEnabled === true;

      const defaultProductUnit =
  String(setupData.defaultProductUnit || '')
    .trim()
    .replace(/[\r\n]/g, ' ');

const defaultCustomerArea =
  String(setupData.defaultCustomerArea || '')
    .trim()
    .replace(/[\r\n]/g, ' ');

      const syncCustomersToOrderFlow =
  setupData.syncCustomersToOrderFlow === true;

const syncProductsToOrderFlow =
  setupData.syncProductsToOrderFlow === true;

      const pricingMethod = [
  'standard',
  'opening',
  'price_levels'
].includes(
  String(setupData.pricingMethod || '').trim()
)
  ? String(setupData.pricingMethod).trim()
  : 'standard';

const highestPriceLevel =
  String(setupData.highestPriceLevel || '').trim();

const mediumPriceLevel =
  String(setupData.mediumPriceLevel || '').trim();

const lowestPriceLevel =
  String(setupData.lowestPriceLevel || '').trim();

const specialPriceLevel =
  String(setupData.specialPriceLevel || '').trim();


      const cgstLedgers =
        Array.isArray(
          setupData.cgstLedgers
        )
          ? setupData.cgstLedgers
          : [];


      const sgstLedgers =
        Array.isArray(
          setupData.sgstLedgers
        )
          ? setupData.sgstLedgers
          : [];


      const igstLedgers =
        Array.isArray(
          setupData.igstLedgers
        )
          ? setupData.igstLedgers
          : [];


      
const commonCgstLedgers = Array.isArray(
  setupData.commonCgstLedgers
)
  ? [
      ...new Set(
        setupData.commonCgstLedgers
          .map(name => String(name).trim())
          .filter(Boolean)
      )
    ]
  : [];

const commonCgstLedger =
  commonCgstLedgers.includes(
    String(setupData.commonCgstLedger || '').trim()
  )
    ? String(setupData.commonCgstLedger).trim()
    : commonCgstLedgers[0] ||
      String(setupData.commonCgstLedger || '').trim();


const commonSgstLedgers = Array.isArray(
  setupData.commonSgstLedgers
)
  ? [
      ...new Set(
        setupData.commonSgstLedgers
          .map(name => String(name).trim())
          .filter(Boolean)
      )
    ]
  : [];

const commonSgstLedger =
  commonSgstLedgers.includes(
    String(setupData.commonSgstLedger || '').trim()
  )
    ? String(setupData.commonSgstLedger).trim()
    : commonSgstLedgers[0] ||
      String(setupData.commonSgstLedger || '').trim();


const commonIgstLedgers = Array.isArray(
  setupData.commonIgstLedgers
)
  ? [
      ...new Set(
        setupData.commonIgstLedgers
          .map(name => String(name).trim())
          .filter(Boolean)
      )
    ]
  : [];

const commonIgstLedger =
  commonIgstLedgers.includes(
    String(setupData.commonIgstLedger || '').trim()
  )
    ? String(setupData.commonIgstLedger).trim()
    : commonIgstLedgers[0] ||
      String(setupData.commonIgstLedger || '').trim();


      const roundOffLedger =
  String(
    setupData.roundOffLedger || ''
  ).trim();

  const salesLedgers = Array.isArray(
  setupData.salesLedgers
)
  ? [
      ...new Set(
        setupData.salesLedgers
          .map(name => String(name).trim())
          .filter(Boolean)
      )
    ]
  : [];

const salesLedger = salesLedgers.includes(
  String(setupData.salesLedger || '').trim()
)
  ? String(setupData.salesLedger).trim()
  : salesLedgers[0] || '';

  const salesVoucherTypes = Array.isArray(
  setupData.salesVoucherTypes
)
  ? [
      ...new Set(
        setupData.salesVoucherTypes
          .map(name => String(name).trim())
          .filter(Boolean)
      )
    ]
  : [];

const salesVoucherType = salesVoucherTypes.includes(
  String(setupData.salesVoucherType || '').trim()
)
  ? String(setupData.salesVoucherType).trim()
  : salesVoucherTypes[0] || '';


      // =================================
      // VALIDATE COMPANY
      // =================================

      if (
        !tallyCompany
      ) {

        return {

          success:
            false,

          error:
            'Please enter Tally Company Name.'

        };

      }




      // =================================
      // VALIDATE GST SETUP
      // =================================

      if (
        gstEnabled
      ) {

        const hasCgstSetup =
          cgstLedgers.length > 0
          ||
          Boolean(
            commonCgstLedger
          );


        const hasSgstSetup =
          sgstLedgers.length > 0
          ||
          Boolean(
            commonSgstLedger
          );


        const hasIgstSetup =
          igstLedgers.length > 0
          ||
          Boolean(
            commonIgstLedger
          );


        if (

          !hasCgstSetup
          &&
          !hasSgstSetup
          &&
          !hasIgstSetup

        ) {

          return {

            success:
              false,

            error:
              'Please configure at least one GST ledger.'

          };

        }

      }


      // =================================
      // GET ENV FILE
      // =================================

      const envPath =
        getEnvPath();


      let envContent =
        '';


      if (

        fs.existsSync(
          envPath
        )

      ) {

        envContent =
          fs.readFileSync(

            envPath,

            'utf8'

          );

      }

            // =================================
      // REMOVE OLD TALLY SETTINGS
      // =================================

      envContent =
        envContent

          .replace(
            /^TALLY_HOST=.*$/gm,
            ''
          )

          .replace(
            /^TALLY_PORT=.*$/gm,
            ''
          )

          .replace(
            /^TALLY_COMPANY=.*$/gm,
            ''
          )

          .replace(
            /^GST_ENABLED=.*$/gm,
            ''
          )

          .replace(/^PRICING_METHOD=.*$/gm, '')
.replace(/^PRICE_LEVEL_HIGHEST=.*$/gm, '')
.replace(/^PRICE_LEVEL_MEDIUM=.*$/gm, '')
.replace(/^PRICE_LEVEL_LOWEST=.*$/gm, '')
.replace(/^PRICE_LEVEL_SPECIAL=.*$/gm, '')

          .replace(
            /^CGST_LEDGERS=.*$/gm,
            ''
          )

          .replace(
            /^SGST_LEDGERS=.*$/gm,
            ''
          )

          .replace(
            /^IGST_LEDGERS=.*$/gm,
            ''
          )

          
.replace(/^COMMON_CGST_LEDGERS=.*$/gm, '')
.replace(/^COMMON_SGST_LEDGERS=.*$/gm, '')
.replace(/^COMMON_IGST_LEDGERS=.*$/gm, '')


.replace(
  /^ROUND_OFF_LEDGER=.*$/gm,
  ''
)

.replace(
  /^SALES_LEDGER=.*$/gm,
  ''
)

.replace(
  /^SALES_LEDGERS=.*$/gm,
  ''
)

.replace(
  /^SALES_VOUCHER_TYPE=.*$/gm,
  ''
)
.replace(
  /^SALES_VOUCHER_TYPES=.*$/gm,
  ''
);


      // =================================
      // CONVERT LEDGER ARRAYS TO JSON
      // =================================

      const cgstLedgersJson =
        JSON.stringify(
          cgstLedgers
        );


      const sgstLedgersJson =
        JSON.stringify(
          sgstLedgers
        );


      const igstLedgersJson =
        JSON.stringify(
          igstLedgers
        );


      // =================================
      // ADD NEW TALLY SETTINGS
      // =================================

      envContent += `

TALLY_HOST=${tallyHost}
TALLY_PORT=${tallyPort}
TALLY_COMPANY=${tallyCompany}

DEFAULT_PRODUCT_UNIT=${defaultProductUnit}
DEFAULT_CUSTOMER_AREA=${defaultCustomerArea}
SYNC_CUSTOMERS_TO_ORDER_FLOW=${syncCustomersToOrderFlow}
SYNC_PRODUCTS_TO_ORDER_FLOW=${syncProductsToOrderFlow}

GST_ENABLED=${gstEnabled}

PRICING_METHOD=${pricingMethod}
PRICE_LEVEL_HIGHEST=${highestPriceLevel}
PRICE_LEVEL_MEDIUM=${mediumPriceLevel}
PRICE_LEVEL_LOWEST=${lowestPriceLevel}
PRICE_LEVEL_SPECIAL=${specialPriceLevel}

CGST_LEDGERS=${cgstLedgersJson}
SGST_LEDGERS=${sgstLedgersJson}
IGST_LEDGERS=${igstLedgersJson}


COMMON_CGST_LEDGERS=${JSON.stringify(commonCgstLedgers)}
COMMON_CGST_LEDGER=${commonCgstLedger}

COMMON_SGST_LEDGERS=${JSON.stringify(commonSgstLedgers)}
COMMON_SGST_LEDGER=${commonSgstLedger}

COMMON_IGST_LEDGERS=${JSON.stringify(commonIgstLedgers)}
COMMON_IGST_LEDGER=${commonIgstLedger}

ROUND_OFF_LEDGER=${roundOffLedger}
SALES_LEDGERS=${JSON.stringify(salesLedgers)}
SALES_LEDGER=${salesLedger}
SALES_VOUCHER_TYPES=${JSON.stringify(salesVoucherTypes)}
SALES_VOUCHER_TYPE=${salesVoucherType}
`;


      // =================================
      // SAVE ENV FILE
      // =================================

      fs.writeFileSync(

        envPath,

        envContent,

        'utf8'

      );


      console.log(
        'Tally setup saved successfully.'
      );


      console.log(
        'Tally Company:',
        tallyCompany
      );


      console.log(
        'GST Enabled:',
        gstEnabled
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

            // =================================
      // CLOSE SETUP WINDOW
      // =================================

      if (
        setupWindow
      ) {

        setupWindow.close();

      }


      // =================================
      // CLOSE ACTIVATION WINDOW
      // =================================

      if (
        activationWindow
      ) {

        activationWindow.close();

      }

      syncCustomersAfterSetup = syncCustomersToOrderFlow;


      // =================================
      // START BRIDGE
      // =================================

      syncProductsAfterSetup = syncProductsToOrderFlow;
      startBridge();


      updateMenu();


      return {

        success:
          true

      };


    } catch (error) {

      console.error(
        'Setup save error:',
        error
      );


      return {

        success:
          false,

        error:
          error.message

      };

    }

  }

);

function requestProductSync() {
  if (
    !bridgeProcess ||
    !bridgeProcess.stdin ||
    !bridgeProcess.stdin.writable
  ) {
    console.error(
      '[PRODUCT SYNC] Bridge is not ready to receive the sync command.'
    );
    return;
  }

  if (productSyncRunning) {
    return;
  }

  productSyncRunning = true;
  updateMenu();

  bridgeProcess.stdin.write(
    JSON.stringify({
      command: 'sync-products'
    }) + '\n',
    (error) => {
      if (error) {
        productSyncRunning = false;
        updateMenu();

        console.error(
          '[PRODUCT SYNC] Could not start sync:',
          error.message
        );
      }
    }
  );
}


function requestCustomerSync() {
  if (
    !bridgeProcess ||
    !bridgeProcess.stdin ||
    !bridgeProcess.stdin.writable
  ) {
    console.error(
      '[CUSTOMER SYNC] Bridge is not ready to receive the command.'
    );
    return;
  }

  if (customerSyncRunning) {
    return;
  }

  customerSyncRunning = true;

  bridgeProcess.stdin.write(
    JSON.stringify({
      command: 'sync-customers-once'
    }) + '\n',
    (error) => {
      if (error) {
        customerSyncRunning = false;

        console.error(
          '[CUSTOMER SYNC] Could not start import:',
          error.message
        );
      }
    }
  );
}

// =================================
// START TALLY BRIDGE
// =================================

function startBridge() {



  if (
    bridgeProcess
  ) {

    console.log(
      'Bridge is already running.'
    );

    return;

  }


  // =================================
  // CHECK ACTIVATION
  // =================================

  if (
    !isActivated()
  ) {

    console.log(
      'Bridge is not activated.'
    );

    updateMenu();

    return;

  }


  // =================================
  // CHECK TALLY SETUP
  // =================================

  if (
    !isTallySetupComplete()
  ) {

    console.log(
      'Tally setup is required.'
    );


    showSetupWindow();


    updateMenu();

    return;

  }


  console.log(
    'Starting Tally Bridge...'
  );


  const bridgePath =
    path.join(
      __dirname,
      'index.js'
    );


  // =================================
  // CHECK INDEX.JS EXISTS
  // =================================

  if (
    !fs.existsSync(
      bridgePath
    )
  ) {

    console.error(
      'index.js not found:',
      bridgePath
    );

    return;

  }


  // =================================
  // START INDEX.JS
  // =================================

  bridgeProcess =
    spawn(

      process.execPath,

      [
        bridgePath
      ],

      {

        windowsHide:
          false,

        env: {

          ...process.env,

          ELECTRON_RUN_AS_NODE:
            '1'

        }

      }

    );

    // Apply the current Product Sync ON/OFF setting
  // whenever the bridge process starts.
  bridgeProcess.stdin.write(
    JSON.stringify({
      command: 'set-product-sync',
      enabled: productSyncEnabled
    }) + '\n',
    (error) => {
      if (error) {
        console.error(
          '[PRODUCT SYNC] Could not apply setting:',
          error.message
        );
      }
    }
  );


  // =================================
  // BRIDGE OUTPUT
  // =================================

  bridgeProcess.stdout.on('data', data => {
  const output = data.toString();

  console.log('[BRIDGE] ' + output);

  bridgeStdoutBuffer += output;

  const lines = bridgeStdoutBuffer.split(/\r?\n/);
  bridgeStdoutBuffer = lines.pop() || '';

  for (const line of lines) {
        // Save only useful diagnostic messages, not every output line.
    if (
      /\b(error|failed|failure|exception|timeout|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|EPIPE|REALTIME LISTENER IS READY|PRODUCT_SYNC_RESULT|PRODUCT AUTO SYNC|PRODUCT SYNC)\b/i.test(line)
    ) {
      writeSupportLog(
        /\b(error|failed|failure|exception|timeout|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|EPIPE)\b/i.test(line)
          ? 'ERROR'
          : 'INFO',
        line
      );
    }
    
if (line.includes('REALTIME LISTENER IS READY')) {
  if (syncCustomersAfterSetup) {
    syncCustomersAfterSetup = false;

    console.log(
      '[BRIDGE] Starting initial customer import.'
    );

    requestCustomerSync();

  } else if (syncProductsAfterSetup) {
    syncProductsAfterSetup = false;

    console.log(
      '[BRIDGE] Starting initial product sync.'
    );

    requestProductSync();
  }
}


const customerPrefix = 'CUSTOMER_SYNC_RESULT:';

if (line.startsWith(customerPrefix)) {
  try {
    const result = JSON.parse(
      line.slice(customerPrefix.length)
    );

    customerSyncRunning = false;

    if (result.success) {
      console.log(
        '[CUSTOMER SYNC] Initial customer import completed.',
        `Inserted: ${result.inserted || 0}`
      );

      if (tray) {
        tray.displayBalloon({
          title: 'Tally Bridge',
          content:
            `Customer import completed. ` +
            `Inserted: ${result.inserted || 0}.`
        });
      }

    } else {
      console.error(
        '[CUSTOMER SYNC ERROR]',
        result.error || 'Unknown customer import error'
      );

      if (tray) {
        tray.displayBalloon({
          title: 'Tally Bridge',
          content:
            'Customer import failed: ' +
            String(result.error || 'Unknown error').slice(0, 150)
        });
      }
    }

    // If the initial product import was also selected,
    // start it after the customer import has returned.
    if (syncProductsAfterSetup) {
      syncProductsAfterSetup = false;

      console.log(
        '[BRIDGE] Starting initial product sync.'
      );

      requestProductSync();
    }

  } catch (error) {
    customerSyncRunning = false;

    console.error(
      '[BRIDGE] Could not read customer sync result:',
      error.message
    );
  }

  continue;
}

    const prefix = 'PRODUCT_SYNC_RESULT:';

    if (!line.startsWith(prefix)) continue;

    try {
      const result = JSON.parse(line.slice(prefix.length));

      productSyncRunning = false;
      updateMenu();

      if (tray) {
        tray.displayBalloon({
          title: 'Tally Bridge',
          content: result.success
            ? `Products synced. Added: ${result.inserted}, updated: ${result.updated}, unchanged: ${result.unchanged}.`
            : `Product sync failed: ${String(result.error || 'Unknown error').slice(0, 180)}`
        });
      }
    } catch (error) {
      console.error(
        '[BRIDGE] Could not read product sync result:',
        error.message
      );
    }
  }
});


  // =================================
  // BRIDGE ERRORS
  // =================================

  bridgeProcess.stderr.on(

    'data',

    (data) => {

      console.error(
        '[BRIDGE ERROR] ' +
        data.toString()
      );
    if (typeof writeSupportLog === 'function') {
  writeSupportLog('ERROR', data.toString());
}

    }

  );


  // =================================
  // BRIDGE PROCESS ERROR
  // =================================

  bridgeProcess.on(

    'error',

    (error) => {

      console.error(
        'Bridge process error:',
        error.message
      );


      bridgeProcess =
        null;


      updateMenu();

    }

  );


  // =================================
  // BRIDGE PROCESS EXIT
  // =================================

  bridgeProcess.on(

    'exit',

    (
      code,
      signal
    ) => {

      console.log(
        'Tally Bridge stopped.'
      );


      console.log(
        'Exit code:',
        code
      );


      console.log(
        'Signal:',
        signal
      );


      bridgeProcess =
        null;


      updateMenu();

    }

  );


  updateMenu();

}


// =================================
// STOP TALLY BRIDGE
// =================================

function stopBridge() {

  if (
    !bridgeProcess
  ) {

    console.log(
      'Bridge is not running.'
    );

    return;

  }


  console.log(
    'Stopping Tally Bridge...'
  );


  bridgeProcess.kill();


  bridgeProcess =
    null;


  updateMenu();

}


function getSalesLedgerSettings() {
  const envPath = getEnvPath();

  if (!fs.existsSync(envPath)) {
    return {
      ledgers: [],
      selectedLedger: ''
    };
  }

  const envContent = fs.readFileSync(
    envPath,
    'utf8'
  );

  const listMatch = envContent.match(
    /^SALES_LEDGERS=(.*)$/m
  );

  const selectedMatch = envContent.match(
    /^SALES_LEDGER=(.*)$/m
  );

  let ledgers = [];

  try {
    ledgers = listMatch
      ? JSON.parse(listMatch[1])
      : [];
  } catch (error) {
    console.error(
      'Could not parse Sales Ledgers:',
      error.message
    );
  }

  if (!Array.isArray(ledgers)) {
    ledgers = [];
  }

  ledgers = [
    ...new Set(
      ledgers
        .map(name => String(name).trim())
        .filter(Boolean)
    )
  ];

  const savedSelection = selectedMatch
    ? selectedMatch[1].trim()
    : '';

  const selectedLedger = ledgers.includes(
    savedSelection
  )
    ? savedSelection
    : ledgers[0] || '';

  return {
    ledgers,
    selectedLedger
  };
}


function getSalesVoucherTypeSettings() {
  const envPath = getEnvPath();

  if (!fs.existsSync(envPath)) {
    return {
      voucherTypes: [],
      selectedVoucherType: ''
    };
  }

  const envContent = fs.readFileSync(
    envPath,
    'utf8'
  );

  const listMatch = envContent.match(
    /^SALES_VOUCHER_TYPES=(.*)$/m
  );

  const selectedMatch = envContent.match(
    /^SALES_VOUCHER_TYPE=(.*)$/m
  );

  let voucherTypes = [];

  try {
    voucherTypes = listMatch
      ? JSON.parse(listMatch[1])
      : [];
  } catch (error) {
    console.error(
      'Could not parse Sales Voucher Types:',
      error.message
    );
  }

  if (!Array.isArray(voucherTypes)) {
    voucherTypes = [];
  }

  voucherTypes = [
    ...new Set(
      voucherTypes
        .map(name => String(name).trim())
        .filter(Boolean)
    )
  ];

  const savedSelection = selectedMatch
    ? selectedMatch[1].trim()
    : '';

  const selectedVoucherType =
    voucherTypes.includes(savedSelection)
      ? savedSelection
      : voucherTypes[0] || '';

  return {
    voucherTypes,
    selectedVoucherType
  };
}


function getCommonGstLedgerSettings(taxType) {
  const config = {
    CGST: {
      listKey: 'COMMON_CGST_LEDGERS',
      selectedKey: 'COMMON_CGST_LEDGER'
    },
    SGST: {
      listKey: 'COMMON_SGST_LEDGERS',
      selectedKey: 'COMMON_SGST_LEDGER'
    },
    IGST: {
      listKey: 'COMMON_IGST_LEDGERS',
      selectedKey: 'COMMON_IGST_LEDGER'
    }
  }[taxType];

  if (!config) {
    throw new Error('Invalid GST type: ' + taxType);
  }

  const envPath = getEnvPath();

  if (!fs.existsSync(envPath)) {
    return {
      ledgers: [],
      selectedLedger: ''
    };
  }

  const envContent = fs.readFileSync(envPath, 'utf8');

  const listMatch = envContent.match(
    new RegExp('^' + config.listKey + '=(.*)$', 'm')
  );

  const selectedMatch = envContent.match(
    new RegExp('^' + config.selectedKey + '=(.*)$', 'm')
  );

  let ledgers = [];

  try {
    ledgers = listMatch ? JSON.parse(listMatch[1]) : [];
  } catch (error) {
    console.error(
      'Could not parse ' + taxType + ' ledgers:',
      error.message
    );
  }

  if (!Array.isArray(ledgers)) {
    ledgers = [];
  }

  ledgers = [
    ...new Set(
      ledgers
        .map(name => String(name).trim())
        .filter(Boolean)
    )
  ];

  const savedSelection = selectedMatch
    ? selectedMatch[1].trim()
    : '';

  return {
    ledgers,
    selectedLedger: ledgers.includes(savedSelection)
      ? savedSelection
      : ledgers[0] || ''
  };
}


function switchCommonGstLedger(taxType, ledgerName) {
  const config = {
    CGST: {
      listKey: 'COMMON_CGST_LEDGERS',
      selectedKey: 'COMMON_CGST_LEDGER'
    },
    SGST: {
      listKey: 'COMMON_SGST_LEDGERS',
      selectedKey: 'COMMON_SGST_LEDGER'
    },
    IGST: {
      listKey: 'COMMON_IGST_LEDGERS',
      selectedKey: 'COMMON_IGST_LEDGER'
    }
  }[taxType];

  if (!config) {
    console.error('Invalid GST type:', taxType);
    return;
  }

  const { ledgers } = getCommonGstLedgerSettings(taxType);

  if (!ledgers.includes(ledgerName)) {
    console.error(
      'Invalid ' + taxType + ' ledger selection:',
      ledgerName
    );
    return;
  }

  const envPath = getEnvPath();

  let envContent = fs.readFileSync(envPath, 'utf8');

  const escapedKey = config.selectedKey.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  const selectedLine =
    `${config.selectedKey}=${ledgerName}`;

  const selectedRegex = new RegExp(
    '^' + escapedKey + '=.*$',
    'm'
  );

  if (selectedRegex.test(envContent)) {
    envContent = envContent.replace(
      selectedRegex,
      selectedLine
    );
  } else {
    envContent += `\n${selectedLine}\n`;
  }

  fs.writeFileSync(envPath, envContent, 'utf8');

  console.log(
    `Selected ${taxType} Ledger:`,
    ledgerName
  );

  if (bridgeProcess) {
    const processToRestart = bridgeProcess;

    processToRestart.once('exit', () => {
      if (bridgeProcess === processToRestart) {
        bridgeProcess = null;
        startBridge();
      }
    });

    processToRestart.kill();
  }

  updateMenu();
}




function switchSalesLedger(ledgerName) {
  const { ledgers } = getSalesLedgerSettings();

  if (!ledgers.includes(ledgerName)) {
    console.error(
      'Invalid Sales Ledger selection:',
      ledgerName
    );
    return;
  }

  const envPath = getEnvPath();

  let envContent = fs.readFileSync(
    envPath,
    'utf8'
  );

  const ledgerLine =
    `SALES_LEDGER=${ledgerName}`;

  if (/^SALES_LEDGER=.*$/m.test(envContent)) {
    envContent = envContent.replace(
      /^SALES_LEDGER=.*$/m,
      ledgerLine
    );
  } else {
    envContent += `\n${ledgerLine}\n`;
  }

  fs.writeFileSync(
    envPath,
    envContent,
    'utf8'
  );

  console.log(
    'Selected Sales Ledger:',
    ledgerName
  );

  // index.js reads SALES_LEDGER at startup.
  // Restart it so the new selection takes effect.
  if (bridgeProcess) {
    const processToRestart = bridgeProcess;

    processToRestart.once('exit', () => {
      if (bridgeProcess === processToRestart) {
        bridgeProcess = null;
        startBridge();
      }
    });

    processToRestart.kill();
  }

  updateMenu();
}


function switchSalesVoucherType(voucherTypeName) {
  const { voucherTypes } = getSalesVoucherTypeSettings();

  if (!voucherTypes.includes(voucherTypeName)) {
    console.error(
      'Invalid Sales Voucher Type selection:',
      voucherTypeName
    );
    return;
  }

  const envPath = getEnvPath();

  let envContent = fs.readFileSync(
    envPath,
    'utf8'
  );

  const voucherTypeLine =
    `SALES_VOUCHER_TYPE=${voucherTypeName}`;

  if (/^SALES_VOUCHER_TYPE=.*$/m.test(envContent)) {
    envContent = envContent.replace(
      /^SALES_VOUCHER_TYPE=.*$/m,
      voucherTypeLine
    );
  } else {
    envContent += `\n${voucherTypeLine}\n`;
  }

  fs.writeFileSync(
    envPath,
    envContent,
    'utf8'
  );

  console.log(
    'Selected Sales Voucher Type:',
    voucherTypeName
  );

  // Restart the bridge so the selected voucher type
  // is loaded from the updated environment.
  if (bridgeProcess) {
    const processToRestart = bridgeProcess;

    processToRestart.once('exit', () => {
      if (bridgeProcess === processToRestart) {
        bridgeProcess = null;
        startBridge();
      }
    });

    processToRestart.kill();
  }

  updateMenu();
}

// =================================
// UPDATE TRAY MENU
// =================================

function updateMenu() {

  if (
    !tray
  ) {

    return;

  }


  const activated =
    isActivated();


  const isRunning =
    bridgeProcess !== null;


  const setupComplete =
    isTallySetupComplete();


  const contextMenu =
    Menu.buildFromTemplate([


      // =================================
      // STATUS
      // =================================

      {

        label:

          !activated

            ? '⚠ Tally Bridge Not Activated'

            : isRunning

              ? '● Tally Bridge Running'

              : '○ Tally Bridge Stopped',


        enabled:
          false

      },


      {

        label:

          setupComplete

            ? '✓ Tally Setup Complete'

            : '⚠ Tally Setup Required',


        enabled:
          false

      },


      {

        type:
          'separator'

      },


      // =================================
      // ACTIVATE
      // =================================

      {

        label:
          'Activate Bridge',


        enabled:
          !activated,


        click:
          showActivationWindow

      },


            // =================================
      // TALLY SETUP
      // =================================

      {

        label:
          'Tally Setup',

        visible:
          !setupComplete,

        enabled:
          activated,

        click:
          showSetupWindow

      },

      
{
  label: 'Sales Ledger',

  submenu: (() => {
    const {
      ledgers,
      selectedLedger
    } = getSalesLedgerSettings();

    if (ledgers.length === 0) {
      return [
        {
          label: 'Configure in Tally Setup',
          enabled: false
        }
      ];
    }

    return ledgers.map(ledger => ({
      label: ledger,
      type: 'radio',
      checked: ledger === selectedLedger,

      click: () => {
        if (ledger !== selectedLedger) {
          switchSalesLedger(ledger);
        }
      }
    }));
  })()
},


{
  label: 'Voucher Type',

  submenu: (() => {
    const {
      voucherTypes,
      selectedVoucherType
    } = getSalesVoucherTypeSettings();

    if (voucherTypes.length === 0) {
      return [
        {
          label: 'Configure in Tally Setup',
          enabled: false
        }
      ];
    }

    return voucherTypes.map(voucherType => ({
      label: voucherType,
      type: 'radio',
      checked: voucherType === selectedVoucherType,

      click: () => {
        if (voucherType !== selectedVoucherType) {
          switchSalesVoucherType(voucherType);
        }
      }
    }));
  })()
},


{
  label: 'Common CGST Ledger',

  submenu: (() => {
    const {
      ledgers,
      selectedLedger
    } = getCommonGstLedgerSettings('CGST');

    if (ledgers.length === 0) {
      return [{
        label: 'Configure in Tally Setup',
        enabled: false
      }];
    }

    return ledgers.map(ledger => ({
      label: ledger,
      type: 'radio',
      checked: ledger === selectedLedger,

      click: () => {
        if (ledger !== selectedLedger) {
          switchCommonGstLedger('CGST', ledger);
        }
      }
    }));
  })()
},

{
  label: 'Common SGST Ledger',

  submenu: (() => {
    const {
      ledgers,
      selectedLedger
    } = getCommonGstLedgerSettings('SGST');

    if (ledgers.length === 0) {
      return [{
        label: 'Configure in Tally Setup',
        enabled: false
      }];
    }

    return ledgers.map(ledger => ({
      label: ledger,
      type: 'radio',
      checked: ledger === selectedLedger,

      click: () => {
        if (ledger !== selectedLedger) {
          switchCommonGstLedger('SGST', ledger);
        }
      }
    }));
  })()
},

{
  label: 'Common IGST Ledger',

  submenu: (() => {
    const {
      ledgers,
      selectedLedger
    } = getCommonGstLedgerSettings('IGST');

    if (ledgers.length === 0) {
      return [{
        label: 'Configure in Tally Setup',
        enabled: false
      }];
    }

    return ledgers.map(ledger => ({
      label: ledger,
      type: 'radio',
      checked: ledger === selectedLedger,

      click: () => {
        if (ledger !== selectedLedger) {
          switchCommonGstLedger('IGST', ledger);
        }
      }
    }));
  })()
},





      {

        type:
          'separator'

      },


      // =================================
      // START BRIDGE
      // =================================

      {

        label:
          'Start Bridge',


        enabled:

          activated

          &&

          setupComplete

          &&

          !isRunning,


        click:
          startBridge

      },


      // =================================
      // STOP BRIDGE
      // =================================

      {

        label:
          'Stop Bridge',


        enabled:
          isRunning,


        click:
          stopBridge

      },


      {

        type:
          'separator'

      },




{
  label: productSyncEnabled
    ? 'Product Sync: ON'
    : 'Product Sync: OFF',

  enabled: activated && setupComplete && isRunning,

  click: () => {
    if (
      !bridgeProcess ||
      !bridgeProcess.stdin ||
      !bridgeProcess.stdin.writable
    ) {
      console.error(
        '[PRODUCT SYNC] Bridge is not running.'
      );
      return;
    }

    const nextEnabled = !productSyncEnabled;

    bridgeProcess.stdin.write(
      JSON.stringify({
        command: 'set-product-sync',
        enabled: nextEnabled
      }) + '\n',
      (error) => {
        if (error) {
          console.error(
            '[PRODUCT SYNC] Could not change setting:',
            error.message
          );
          return;
        }

        productSyncEnabled = nextEnabled;
        updateMenu();
      }
    );
  }
},

{
  type: 'separator'
},


      // =================================
      // EXIT
      // =================================

      {

        label:
          'Exit Tally Bridge',


        click:
          () => {

            isQuitting =
              true;


            if (
              bridgeProcess
            ) {

              bridgeProcess.kill();


              bridgeProcess =
                null;

            }


            app.quit();

          }

      }

    ]);



  tray.setContextMenu(
    contextMenu
  );

}


// =================================
// CREATE TRAY
// =================================

function createTray() {

  let trayIcon;


  if (
    fs.existsSync(
      iconPath
    )
  ) {

    trayIcon =
      nativeImage.createFromPath(
        iconPath
      );

  } else {

    trayIcon =
      nativeImage.createEmpty();

  }


  tray =
    new Tray(
      trayIcon
    );


  tray.setToolTip(
    'Tally Bridge'
  );


  updateMenu();


  tray.on(

    'double-click',

    () => {

      if (
        !isActivated()
      ) {

        showActivationWindow();

        return;

      }


      showSetupWindow();

    }

  );


  console.log(
    'Tally Bridge tray application started.'
  );

}


// =================================
// APP READY
// =================================

app.whenReady().then(

  () => {

    // Enable Windows startup

    enableAutoStart();


    // Create tray

    createTray();

  




    // =================================
    // CHECK ACTIVATION
    // =================================

    if (
      !isActivated()
    ) {

      console.log(
        'Bridge is not activated.'
      );


      showActivationWindow();


      return;

    }


    console.log(
      'Bridge is already activated.'
    );


    // =================================
    // CHECK TALLY SETUP
    // =================================

    if (
      !isTallySetupComplete()
    ) {

      console.log(
        'Tally setup is required.'
      );


      showSetupWindow();


      return;

    }


    console.log(
      'Tally setup is complete.'
    );


    // =================================
    // START BRIDGE
    // =================================

    startBridge();

  }

);


// =================================
// PREVENT APP FROM EXITING
// =================================

app.on(

  'window-all-closed',

  () => {

    // Keep application running
    // in the system tray.

  }

);


// =================================
// APP QUIT
// =================================

app.on(

  'before-quit',

  () => {

    isQuitting =
      true;


    if (
      bridgeProcess
    ) {

      bridgeProcess.kill();


      bridgeProcess =
        null;

    }

  }

);


// =================================
// ACTIVATE APP
// =================================

app.on(

  'activate',

  () => {

    if (
      BrowserWindow.getAllWindows()
        .length === 0
    ) {

      if (
        !isActivated()
      ) {

        showActivationWindow();

      }

    }

  }

);