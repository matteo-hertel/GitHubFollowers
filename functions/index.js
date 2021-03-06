"use strict";

const nodeFetch = require("node-fetch");
const functions = require("firebase-functions"); // Cloud Functions for Firebase library
const DialogflowApp = require("actions-on-google").DialogflowApp; // Google Assistant helper library
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(
  (request, response) => {
    console.log(
      "Dialogflow Request headers: " + JSON.stringify(request.headers)
    );
    console.log("Dialogflow Request body: " + JSON.stringify(request.body));
    if (request.body.result) {
      processV1Request(request, response);
    } else if (request.body.queryResult) {
      return response
        .status(400)
        .end("Invalid Webhook Request (v2 not supported)");
    } else {
      console.log("Invalid Request");
      return response
        .status(400)
        .end("Invalid Webhook Request (expecting v1 or v2 webhook request)");
    }
  }
);
/*
* Function to handle v1 webhook requests from Dialogflow
*/
function processV1Request(request, response) {
  let action = request.body.result.action; // https://dialogflow.com/docs/actions-and-parameters
  let parameters = request.body.result.parameters; // https://dialogflow.com/docs/actions-and-parameters
  let inputContexts = request.body.result.contexts; // https://dialogflow.com/docs/contexts
  let requestSource = request.body.originalRequest
    ? request.body.originalRequest.source
    : undefined;
  const googleAssistantRequest = "google"; // Constant to identify Google Assistant requests
  const app = new DialogflowApp({ request: request, response: response });
  // Create handlers for Dialogflow actions as well as a 'default' handler
  const actionHandlers = {
    // The default welcome intent has been matched, welcome the user (https://dialogflow.com/docs/events#default_welcome_intent)
    "input.welcome": () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse("Hello, Welcome to my Dialogflow agent!"); // Send simple response to user
      } else {
        sendResponse("Hello, Welcome to my Dialogflow agent!"); // Send simple response to user
      }
    },
    // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
    "input.unknown": () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse("I'm having trouble, can you try that again?"); // Send simple response to user
      } else {
        sendResponse("I'm having trouble, can you try that again?"); // Send simple response to user
      }
    },
    // Default handler for unknown or undefined actions
    default: () => {
      function getGitHubFollowers(username) {
        return nodeFetch(`https://api.github.com/users/${username}`).then(
          res => {
            if (res.status !== 200) {
              throw new Error("Failed to fetch info");
            }
            return res.json();
          }
        );
      }
      function dispatchResponse(responseToUser) {
        if (requestSource === googleAssistantRequest) {
          sendGoogleResponse(responseToUser);
        } else {
          sendResponse(responseToUser);
        }
      }
      getGitHubFollowers(parameters.githubusername)
        .then(data => {
          let responseToUser = {
            speech: `You have ${data.followers} followers on Git Hub`,
            text: `You have ${data.followers} followers on Git Hub`
          };
          dispatchResponse(responseToUser);
        })
        .catch(exc => {
          let responseToUser = {
            speech:
              "I'm really sorry, something went wrong while fetching information from Git Hub",
            text:
              "I'm really sorry, something went wrong while fetching information from Git Hub"
          };

          dispatchResponse(responseToUser);
        });
    }
  };
  // If undefined or unknown action use the default handler
  if (!actionHandlers[action]) {
    action = "default";
  }
  // Run the proper handler function to handle the request from Dialogflow
  actionHandlers[action]();
  // Function to send correctly formatted Google Assistant responses to Dialogflow which are then sent to the user
  function sendGoogleResponse(responseToUser) {
    if (typeof responseToUser === "string") {
      app.tell(responseToUser); // Google Assistant response
    } else {
      // If speech or displayText is defined use it to respond
      let googleResponse = app.buildRichResponse().addSimpleResponse({
        speech: responseToUser.speech || responseToUser.displayText,
        displayText: responseToUser.displayText || responseToUser.speech
      });
      // Optional: Overwrite previous response with rich response
      if (responseToUser.googleRichResponse) {
        googleResponse = responseToUser.googleRichResponse;
      }
      // Optional: add contexts (https://dialogflow.com/docs/contexts)
      if (responseToUser.googleOutputContexts) {
        app.setContext(...responseToUser.googleOutputContexts);
      }
      console.log(
        "Response to Dialogflow (AoG): " + JSON.stringify(googleResponse)
      );
      app.ask(googleResponse); // Send response to Dialogflow and Google Assistant
    }
  }
  // Function to send correctly formatted responses to Dialogflow which are then sent to the user
  function sendResponse(responseToUser) {
    // if the response is a string send it as a response to the user
    if (typeof responseToUser === "string") {
      let responseJson = {};
      responseJson.speech = responseToUser; // spoken response
      responseJson.displayText = responseToUser; // displayed response
      response.json(responseJson); // Send response to Dialogflow
    } else {
      // If the response to the user includes rich responses or contexts send them to Dialogflow
      let responseJson = {};
      // If speech or displayText is defined, use it to respond (if one isn't defined use the other's value)
      responseJson.speech = responseToUser.speech || responseToUser.displayText;
      responseJson.displayText =
        responseToUser.displayText || responseToUser.speech;
      // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
      responseJson.data = responseToUser.data;
      // Optional: add contexts (https://dialogflow.com/docs/contexts)
      responseJson.contextOut = responseToUser.outputContexts;
      console.log("Response to Dialogflow: " + JSON.stringify(responseJson));
      response.json(responseJson); // Send response to Dialogflow
    }
  }
}
