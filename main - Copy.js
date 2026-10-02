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


const TALLY_BRIDGE_URL =
  'https://retqsjcduyobpazqaoce.supabase.co/functions/v1/sync-tally-balances';


const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldHFzamNkdXlvYnBhenFhb2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzI1NzksImV4cCI6MjA3OTAwODU3OX0.GjgHFbhNo8x17ZSIheanP2d_0ouUbFlh6MK2iatbqVE';


// =================================
// GLOBAL VARIABLES
// =================================

let tray = null;

let bridgeProcess = null;

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
  bridgeSecret
) {

  const envPath =
    getEnvPath();


  const envContent =
`TALLY_BRIDGE_URL=${TALLY_BRIDGE_URL}
TALLY_BRIDGE_SECRET=${bridgeSecret}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
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

  if (setupWindow) {

    setupWindow.focus();

    return;

  }


  setupWindow =
  new BrowserWindow({

    width: 1200,

    height: 800,

    minWidth: 900,

    minHeight: 600,

    webPreferences: {

      preload:
        path.join(
          __dirname,
          'preload.js'
        )

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


      // =================================
      // SEND ACTIVATION REQUEST
      // =================================

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

        console.error(
          'Invalid activation response:',
          error
        );


        return {

          success:
            false,

          error:
            'Invalid response from activation server.'

        };

      }


      console.log(
        'Activation server response:',
        result
      );


      // =================================
      // ACTIVATION FAILED
      // =================================

      if (

        !response.ok ||

        !result.success

      ) {

        return {

          success:
            false,

          error:

            result.error ||

            result.message ||

            'Activation failed.'

        };

      }


      // =================================
      // CHECK BRIDGE SECRET
      // =================================

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


      // =================================
      // SAVE ACTIVATION
      // =================================

      saveBridgeSecret(

        result.bridge_secret

      );


      console.log(
        'Tally Bridge activated successfully.'
      );


      // =================================
      // OPEN SETUP WINDOW
      // =================================

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

          error.message ||

          'Could not connect to activation server.'

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

      const tallyCompany =
  String(
    setupData.companyName || ''
  ).trim();

const gstEnabled =
  setupData.gstEnabled === true;

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

const commonCgstLedger =
  String(
    setupData.commonCgstLedger || ''
  ).trim();

const commonSgstLedger =
  String(
    setupData.commonSgstLedger || ''
  ).trim();

const commonIgstLedger =
  String(
    setupData.commonIgstLedger || ''
  ).trim();

      console.log(
        'Saving Tally setup...'
      );

      // =================================
// GET SETUP DATA
// =================================

const tallyHost =
  '127.0.0.1';


const tallyPort =
  '9000';



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
// VALIDATE GST SETUP
// =================================

if (
  gstEnabled
) {

  const hasCgstSetup =
    cgstLedgers.length > 0
    ||
    commonCgstLedger;


  const hasSgstSetup =
    sgstLedgers.length > 0
    ||
    commonSgstLedger;


  const hasIgstSetup =
    igstLedgers.length > 0
    ||
    commonIgstLedger;


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
      // REMOVE OLD SETTINGS
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
    .replace(
      /^COMMON_CGST_LEDGER=.*$/gm,
      ''
    )
    .replace(
      /^COMMON_SGST_LEDGER=.*$/gm,
      ''
    )
    .replace(
      /^COMMON_IGST_LEDGER=.*$/gm,
      ''
    );


      // =================================
      // CONVERT LEDGERS TO JSON
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
      // ADD NEW SETTINGS
      // =================================

// =================================
// ADD NEW SETTINGS
// =================================

envContent += `

TALLY_HOST=${tallyHost}
TALLY_PORT=${tallyPort}
TALLY_COMPANY=${tallyCompany}

GST_ENABLED=${gstEnabled}

CGST_LEDGERS=${cgstLedgersJson}
SGST_LEDGERS=${sgstLedgersJson}
IGST_LEDGERS=${igstLedgersJson}

COMMON_CGST_LEDGER=${commonCgstLedger}
COMMON_SGST_LEDGER=${commonSgstLedger}
COMMON_IGST_LEDGER=${commonIgstLedger}
`;

const tallyCompany =
  String(
    setupData.companyName || ''
  ).trim();

const gstEnabled =
  setupData.gstEnabled === true;

const cgstLedgers =
  Array.isArray(setupData.cgstLedgers)
    ? setupData.cgstLedgers
    : [];

const sgstLedgers =
  Array.isArray(setupData.sgstLedgers)
    ? setupData.sgstLedgers
    : [];

const igstLedgers =
  Array.isArray(setupData.igstLedgers)
    ? setupData.igstLedgers
    : [];

const commonCgstLedger =
  String(
    setupData.commonCgstLedger || ''
  ).trim();

const commonSgstLedger =
  String(
    setupData.commonSgstLedger || ''
  ).trim();

const commonIgstLedger =
  String(
    setupData.commonIgstLedger || ''
  ).trim();
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


      // =================================
      // START BRIDGE
      // =================================

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


  console.log(
    'Starting Tally Bridge...'
  );


  const bridgePath =
    path.join(
      __dirname,
      'index.js'
    );


  // =================================
  // RUN INDEX.JS AS NODE
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


bridgeProcess.stdout.on(

  'data',

  (data) => {

    console.log(
      '[BRIDGE] ' +
      data.toString()
    );

  }

);


bridgeProcess.stderr.on(

  'data',

  (data) => {

    console.error(
      '[BRIDGE ERROR] ' +
      data.toString()
    );

  }

);


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

        type:
          'separator'

      },


      {

        label:
          'Activate Bridge',

        enabled:
          !activated,

        click:
          showActivationWindow

      },

      {
  label:
    'Tally Setup',

  enabled:
    activated,

  click:
    showSetupWindow

},




      {

        label:
          'Stop Sync',

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

        label:
          'Exit Tally Bridge',

        click: () => {

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
// ELECTRON READY
// =================================

app.whenReady().then(() => {


  enableAutoStart();


  // =================================
  // LOAD ICON
  // =================================

  let icon =
    nativeImage.createFromPath(
      iconPath
    );


  if (
    icon.isEmpty()
  ) {

    console.error(
      'Could not load icon:',
      iconPath
    );


    icon =
      nativeImage.createEmpty();

  }


  // =================================
  // CREATE TRAY
  // =================================

  tray =
    new Tray(
      icon
    );


  tray.setToolTip(
    'Tally Bridge'
  );


  // =================================
// START / ACTIVATE / SETUP
// =================================

if (
  isActivated()
) {

  console.log(
    'Bridge is already activated.'
  );


  // Check whether Tally setup
  // has already been completed

  if (
    isTallySetupComplete()
  ) {

    console.log(
      'Tally setup is complete.'
    );


    startBridge();


  } else {

    console.log(
      'Tally setup is required.'
    );


    showSetupWindow();

  }


} else {

  console.log(
    'Bridge requires activation.'
  );


  showActivationWindow();

}


  updateMenu();


  console.log(
    'Tally Bridge tray application started.'
  );


});


// =================================
// KEEP TRAY APP RUNNING
// =================================

app.on(

  'window-all-closed',

  () => {

    // Tray application remains active.

  }

);


// =================================
// CLEANUP
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


    if (
      tray
    ) {

      tray.destroy();

      tray =
        null;

    }

  }

);