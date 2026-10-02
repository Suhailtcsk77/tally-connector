const activationCodeInput =
  document.getElementById(
    'activationCode'
  );

const activateButton =
  document.getElementById(
    'activateButton'
  );

const message =
  document.getElementById(
    'message'
  );


// =================================
// ACTIVATE
// =================================

async function activate() {

  const activationCode =
    activationCodeInput.value
      .trim();


  if (!activationCode) {

    message.textContent =
      'Please enter an activation code.';

    return;

  }


  activateButton.disabled =
    true;


  message.textContent =
    'Activating Tally Bridge...';


  try {

    const result =
      await window.tallyBridge.activate(
        activationCode
      );


    console.log(
      'Activation result:',
      result
    );


    // =================================
    // ACTIVATION SUCCESS
    // =================================

    if (result.success) {

      message.textContent =
        '✓ Activation Successful! Tally Bridge is starting...';


      activateButton.textContent =
        'Activated Successfully ✓';


      // Disable input so user
      // cannot activate again

      activationCodeInput.disabled =
        true;




      return;

    }

    if (result.success) {

  message.textContent =
    '✓ Activation Successful!';


  activateButton.textContent =
    'Activated Successfully ✓';


  activationCodeInput.disabled =
    true;


  activateButton.disabled =
    true;


  return;

}


    // =================================
    // ACTIVATION FAILED
    // =================================

    message.textContent =
      result.error ||
      'Activation failed.';


    activateButton.disabled =
      false;


  } catch (error) {

    console.error(
      'Activation error:',
      error
    );


    message.textContent =
      'Could not connect to activation server.';


    activateButton.disabled =
      false;

  }

}


// =================================
// BUTTON CLICK
// =================================

activateButton.addEventListener(

  'click',

  activate

);


// =================================
// ENTER KEY
// =================================

activationCodeInput.addEventListener(

  'keydown',

  (event) => {

    if (
      event.key === 'Enter'
    ) {

      activate();

    }

  }

);