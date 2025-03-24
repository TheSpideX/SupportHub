(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) =>
    key in obj
      ? __defProp(obj, key, {
          enumerable: true,
          configurable: true,
          writable: true,
          value,
        })
      : (obj[key] = value);
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop)) __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop)) __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __publicField = (obj, key, value) =>
    __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) =>
        x.done
          ? resolve(x.value)
          : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/utils/logger.ts
  var import_meta = {};
  var Logger = class {
    constructor(component) {
      __publicField(
        this,
        "isDevelopment",
        import_meta.env.MODE === "development"
      );
      __publicField(this, "SENSITIVE_FIELDS", [
        "password",
        "token",
        "secret",
        "credential",
        "auth",
      ]);
      __publicField(this, "component");
      this.component = component || "App";
    }
    formatMessage(
      level,
      message,
      context = {},
      category = "system",
      fileIdentifier
    ) {
      const timestamp = /* @__PURE__ */ new Date().toISOString();
      const componentInfo = context.component ? `[${context.component}]` : "";
      const fileInfo = fileIdentifier ? `[${fileIdentifier}]` : "";
      const sanitizedContext = this.sanitizeSensitiveData(context);
      return {
        timestamp,
        level,
        category,
        message: `${componentInfo}${fileInfo} ${message}`,
        metadata: sanitizedContext,
      };
    }
    sanitizeSensitiveData(data) {
      if (!data) return data;
      if (typeof data === "object") {
        const sanitized = __spreadValues({}, data);
        for (const key in sanitized) {
          if (
            this.SENSITIVE_FIELDS.some((field) =>
              key.toLowerCase().includes(field)
            )
          ) {
            sanitized[key] = "[REDACTED]";
          } else if (typeof sanitized[key] === "object") {
            sanitized[key] = this.sanitizeSensitiveData(sanitized[key]);
          }
        }
        return sanitized;
      }
      return data;
    }
    persistLog(logEntry) {
      return __async(this, null, function* () {
        try {
          if (this.isDevelopment) {
            const logs = JSON.parse(localStorage.getItem("app_logs") || "[]");
            logs.push(logEntry);
            localStorage.setItem("app_logs", JSON.stringify(logs.slice(-1e3)));
          }
          if (!this.isDevelopment) {
            yield fetch("/api/logs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(logEntry),
            });
          }
        } catch (error) {
          console.error("Failed to persist log:", error);
        }
      });
    }
    // Add a function to get the calling file information
    getCallerInfo() {
      try {
        const err = new Error();
        const stack = err.stack || "";
        const stackLines = stack.split("\n");
        if (stackLines.length >= 4) {
          const callerLine = stackLines[3];
          const match =
            callerLine.match(/\((.+?):\d+:\d+\)/) ||
            callerLine.match(/at\s+(.+?):\d+:\d+/);
          if (match && match[1]) {
            const fullPath = match[1];
            const pathParts = fullPath.split("/");
            return pathParts[pathParts.length - 1];
          }
        }
        return void 0;
      } catch (e) {
        return void 0;
      }
    }
    debug(message, context = {}, category = "system", fileIdentifier) {
      const caller = fileIdentifier || this.getCallerInfo();
      const logEntry = this.formatMessage(
        "debug",
        message,
        context,
        category,
        caller
      );
      console.debug(logEntry.message, logEntry.metadata);
      this.persistLog(logEntry);
    }
    info(message, context = {}, category = "system", fileIdentifier) {
      const caller = fileIdentifier || this.getCallerInfo();
      const logEntry = this.formatMessage(
        "info",
        message,
        context,
        category,
        caller
      );
      if (this.isDevelopment) {
        console.info(
          `%c${logEntry.message}`,
          "color: #6495ED",
          logEntry.metadata
        );
      }
      this.persistLog(logEntry);
    }
    warn(message, context = {}, category = "system", fileIdentifier) {
      const caller = fileIdentifier || this.getCallerInfo();
      const logEntry = this.formatMessage(
        "warn",
        message,
        context,
        category,
        caller
      );
      console.warn(logEntry.message, logEntry.metadata);
      this.persistLog(logEntry);
    }
    error(message, error, context = {}, category = "system", fileIdentifier) {
      const caller = fileIdentifier || this.getCallerInfo();
      const errorContext = __spreadProps(__spreadValues({}, context), {
        error: this.sanitizeSensitiveData(error),
        stack: error == null ? void 0 : error.stack,
        code: error == null ? void 0 : error.code,
      });
      const logEntry = this.formatMessage(
        "error",
        message,
        errorContext,
        category,
        caller
      );
      console.error(logEntry.message, logEntry.metadata);
      this.persistLog(logEntry);
    }
    trackPerformance(action, duration, context, fileIdentifier) {
      this.info(
        `Performance: ${action}`,
        __spreadProps(__spreadValues({}, context), {
          duration,
          category: "performance",
        }),
        "performance",
        fileIdentifier
      );
    }
  };
  var logger = new Logger();

  // src/features/auth/workers/AuthSharedWorker.ts
  var authState = {
    isAuthenticated: false,
    user: null,
    tokens: null,
    lastUpdate: Date.now(),
    updatedBy: null,
  };
  var connectedPorts = /* @__PURE__ */ new Map();
  var leaderTabId = null;
  self.addEventListener("connect", (e) => {
    const port = e.ports[0];
    let tabId = null;
    port.addEventListener("message", (event) => {
      const message = event.data;
      if (!tabId && message.tabId) {
        tabId = message.tabId;
        connectedPorts.set(tabId, port);
        if (!leaderTabId) {
          leaderTabId = tabId;
          broadcastToAllTabs({
            type: "LEADER_ELECTED",
            payload: { tabId: leaderTabId },
            tabId: "worker",
            timestamp: Date.now(),
          });
        }
        port.postMessage({
          type: "AUTH_STATE_UPDATE",
          payload: authState,
          tabId: "worker",
          timestamp: Date.now(),
        });
        port.postMessage({
          type: "LEADER_INFO",
          payload: { leaderId: leaderTabId },
          tabId: "worker",
          timestamp: Date.now(),
        });
      }
      if (message.type === "TAB_VISIBLE") {
        handleTabVisible(message, port);
        return;
      }
      switch (message.type) {
        case "AUTH_STATE_CHANGED" /* AUTH_STATE_CHANGED */:
          handleAuthStateChange(message);
          break;
        case "LOGOUT" /* LOGOUT */:
          handleLogout(message);
          break;
        case "TOKENS_UPDATED" /* TOKENS_UPDATED */:
        case "TOKENS_REFRESHED" /* TOKENS_REFRESHED */:
          handleTokenUpdate(message);
          break;
        case "USER_ACTIVITY" /* USER_ACTIVITY */:
          relayMessageExcept(message, tabId);
          break;
        case "HEARTBEAT":
          port.postMessage({
            type: "HEARTBEAT_RESPONSE",
            payload: { timestamp: Date.now() },
            tabId: "worker",
            timestamp: Date.now(),
          });
          break;
        case "GET_CONNECTED_TABS":
          port.postMessage({
            type: "CONNECTED_TABS",
            payload: { tabs: Array.from(connectedPorts.keys()) },
            tabId: "worker",
            timestamp: Date.now(),
          });
          break;
        // Add this case to your switch statement in the message handler
        case "REQUEST_LEADER_ELECTION":
          console.info(`Leader election requested by tab ${message.tabId}`);
          // Force a new leader election
          leaderTabId = null;
          electNewLeader();
          break;
      }
    });
    port.start();
    port.addEventListener("messageerror", () => {
      if (tabId) {
        handleTabDisconnect(tabId);
      }
    });
    port.addEventListener("close", () => {
      if (tabId) {
        handleTabDisconnect(tabId);
      }
    });
  });
  function handleTabDisconnect(tabId) {
    console.info(`Tab disconnected: ${tabId}`);

    // Remove the tab from connected ports
    connectedPorts.delete(tabId);

    // If the disconnected tab was the leader, elect a new leader
    if (tabId === leaderTabId) {
      console.info(
        `Leader tab ${leaderTabId} disconnected, electing new leader`
      );
      leaderTabId = null;
      electNewLeader();
    }

    // Broadcast updated connected tabs list
    broadcastToAllTabs({
      type: "CONNECTED_TABS",
      payload: { tabs: Array.from(connectedPorts.keys()) },
      tabId: "worker",
      timestamp: Date.now(),
    });
  }

  function electNewLeader() {
    if (connectedPorts.size > 0) {
      // Get the first available tab as the new leader
      const newLeaderId = Array.from(connectedPorts.keys())[0];

      leaderTabId = newLeaderId;

      console.info(`[AuthSharedWorker] Elected new leader tab: ${leaderTabId}`);

      // Notify all tabs about the new leader
      broadcastToAllTabs({
        type: "LEADER_ELECTED",
        payload: { tabId: leaderTabId },
        tabId: "worker",
        timestamp: Date.now(),
      });

      // Notify the leader specifically to trigger token checks
      const leaderPort = connectedPorts.get(leaderTabId);
      if (leaderPort) {
        leaderPort.postMessage({
          type: "BECOME_LEADER",
          payload: { timestamp: Date.now() },
          tabId: "worker",
          timestamp: Date.now(),
        });
      }
    }
  }

  function handleAuthStateChange(message) {
    var _a, _b;
    const isAuthenticated =
      (_a = message.payload) == null ? void 0 : _a.isAuthenticated;
    const isPriority =
      ((_b = message.payload) == null ? void 0 : _b.isPriority) === true;
    if (message.payload && isAuthenticated !== void 0) {
      const isLoginEvent =
        isAuthenticated === true && authState.isAuthenticated === false;
      const isLogoutEvent =
        isAuthenticated === false && authState.isAuthenticated === true;
      if (isLoginEvent || isLogoutEvent || isPriority) {
        authState = __spreadProps(__spreadValues({}, message.payload), {
          lastUpdate: Date.now(),
          updatedBy: message.tabId,
        });
        broadcastToAllTabs({
          type: "AUTH_STATE_UPDATE",
          payload: __spreadProps(__spreadValues({}, authState), {
            isPriority: true,
            // Mark as priority so other tabs respect it
          }),
          tabId: "worker",
          timestamp: Date.now(),
        });
        console.log(
          `[AuthSharedWorker] Auth state changed: isAuthenticated=${isAuthenticated}, broadcasting to ${connectedPorts.size} tabs`
        );
      } else {
        authState = __spreadProps(
          __spreadValues(__spreadValues({}, authState), message.payload),
          {
            lastUpdate: Date.now(),
            updatedBy: message.tabId,
          }
        );
        broadcastToAllTabs(
          {
            type: "AUTH_STATE_UPDATE",
            payload: authState,
            tabId: "worker",
            timestamp: Date.now(),
          },
          message.tabId
        );
      }
    }
  }
  function handleTokenUpdate(message) {
    if (message.payload) {
      authState = __spreadProps(__spreadValues({}, authState), {
        tokens: message.payload,
        lastUpdate: Date.now(),
        updatedBy: message.tabId,
      });
      broadcastToAllTabs(
        {
          type: "AUTH_STATE_UPDATE",
          payload: authState,
          tabId: "worker",
          timestamp: Date.now(),
        },
        message.tabId
      );
    }
  }
  function handleLogout(message) {
    authState = {
      isAuthenticated: false,
      user: null,
      tokens: null,
      lastUpdate: Date.now(),
      updatedBy: message.tabId,
    };
    try {
      broadcastToAllTabs({
        type: "LOGOUT_CONFIRMED",
        payload: __spreadProps(__spreadValues({}, message.payload), {
          isPriority: true,
          // Mark as high priority
        }),
        tabId: "worker",
        timestamp: Date.now(),
      });
      console.log(
        `[AuthSharedWorker] Broadcast logout to ${connectedPorts.size} tabs`
      );
    } catch (error) {
      console.error("[AuthSharedWorker] Error broadcasting logout:", error);
    }
  }
  function handleTabVisible(message, port) {
    port.postMessage({
      type: "AUTH_STATE_UPDATE",
      payload: authState,
      tabId: "worker",
      timestamp: Date.now(),
    });
  }
  function broadcastToAllTabs(message, exceptTabId) {
    connectedPorts.forEach((port, tabId) => {
      if (!exceptTabId || tabId !== exceptTabId) {
        try {
          port.postMessage(message);
        } catch (err) {
          console.error(`Failed to send message to tab ${tabId}`, err);
          connectedPorts.delete(tabId);
        }
      }
    });
  }
  function relayMessageExcept(message, exceptTabId) {
    connectedPorts.forEach((port, tabId) => {
      if (!exceptTabId || tabId !== exceptTabId) {
        try {
          port.postMessage(message);
        } catch (err) {
          console.error(`Failed to relay message to tab ${tabId}`, err);
          connectedPorts.delete(tabId);
        }
      }
    });
  }
})();
