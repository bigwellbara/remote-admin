"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HubEventType = void 0;
var HubEventType;
(function (HubEventType) {
    HubEventType["CLIENT_CONNECTED"] = "CLIENT_CONNECTED";
    HubEventType["CLIENT_DISCONNECTED"] = "CLIENT_DISCONNECTED";
    HubEventType["COMMAND_QUEUED"] = "COMMAND_QUEUED";
    HubEventType["COMMAND_SENT"] = "COMMAND_SENT";
    HubEventType["COMMAND_COMPLETED"] = "COMMAND_COMPLETED";
    HubEventType["AUTH_FAILED"] = "AUTH_FAILED";
    HubEventType["ERROR"] = "ERROR";
})(HubEventType || (exports.HubEventType = HubEventType = {}));
