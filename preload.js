const {
  contextBridge,
  ipcRenderer
} = require('electron');


contextBridge.exposeInMainWorld(

  'tallyBridge',

  {

    // Activation
    activate: (
      activationCode
    ) =>

      ipcRenderer.invoke(
        'activate-bridge',
        activationCode
      ),


    
    // Save Tally Setup
    saveSetup: (
      setupData
    ) =>
      ipcRenderer.invoke(
        'save-tally-setup',
        setupData
      ),

    // Preview 10 products from Tally
    previewProducts: (
      previewData
    ) =>
      ipcRenderer.invoke(
        'preview-tally-products',
        previewData
      ),

    // Preview 10 customers from Tally
    previewCustomers: (
      previewData
    ) =>
      ipcRenderer.invoke(
        'preview-tally-customers',
        previewData
      )


  }

);