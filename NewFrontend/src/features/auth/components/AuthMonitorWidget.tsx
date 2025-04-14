import React, { useState, useEffect } from "react";
import { useModalState } from "@/context/ModalStateContext";
import { useAuth } from "../hooks/useAuth";
import { useTokenService } from "../hooks/useTokenService";
import { usePrimusAuthService } from "../hooks/usePrimusAuthService";
import {
  getAuthMonitorService,
  AuthMonitorStatus,
} from "../services/AuthMonitorService";
import { AuthEventType } from "@/types/auth";

const AuthMonitorWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { auth } = useAuth();
  const tokenService = useTokenService();
  const primusService = usePrimusAuthService();
  const { isAnyModalOpen } = useModalState();
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [monitorStatus, setMonitorStatus] = useState<AuthMonitorStatus>(
    AuthMonitorStatus.INITIALIZING
  );
  const [deviceId, setDeviceId] = useState<string>("");
  const [tabId, setTabId] = useState<string>("");
  const [isLeaderTab, setIsLeaderTab] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<string>("");
  const [lastEventTime, setLastEventTime] = useState<string>("");

  useEffect(() => {
    if (!tokenService || !primusService) {
      console.log("TokenService or PrimusService not available yet");
      return;
    }

    // Make sure TokenService is properly initialized
    if (typeof tokenService.getCsrfToken !== "function") {
      console.error("TokenService is missing getCsrfToken method");
      return;
    }

    // Make sure TokenService has hasFlag method
    if (typeof tokenService.hasFlag !== "function") {
      console.error("TokenService is missing hasFlag method");
      return;
    }

    try {
      // Initialize the auth monitor service
      let authMonitorService;
      try {
        authMonitorService = getAuthMonitorService(tokenService, primusService);
      } catch (error) {
        console.error("Error getting AuthMonitorService:", error);
        return;
      }

      // Get initial status
      try {
        setMonitorStatus(authMonitorService.getStatus());
      } catch (error) {
        console.error("Error getting monitor status:", error);
      }

      // Get device and tab info
      setDeviceId(sessionStorage.getItem("device_fingerprint") || "");
      setTabId(sessionStorage.getItem("tab_id") || "");

      // Check if leader tab
      try {
        const leaderData = localStorage.getItem(`auth_leader_tab_${deviceId}`);
        if (leaderData) {
          const data = JSON.parse(leaderData);

          // Ensure both values are strings for comparison
          const storedTabId = String(data.tabId || "");
          const currentTabId = String(tabId || "");

          // Compare as strings
          const isLeader = storedTabId === currentTabId;
          setIsLeaderTab(isLeader);

          console.log(
            `Leader check: ${storedTabId} === ${currentTabId} is ${isLeader}`
          );
        }
      } catch (error) {
        console.error("Error checking leader status", error);
      }

      // Listen for status changes
      const handleStatusChange = (data: any) => {
        setMonitorStatus(data.currentStatus);
        setLastEvent("STATUS_CHANGED");
        setLastEventTime(new Date().toLocaleTimeString());
      };

      // Listen for other events
      const handleEvent = (event: string) => (data: any) => {
        setLastEvent(event);
        setLastEventTime(new Date().toLocaleTimeString());
      };

      // Register event listeners
      authMonitorService.on(AuthEventType.STATUS_CHANGED, handleStatusChange);
      authMonitorService.on(AuthEventType.CONNECTED, handleEvent("CONNECTED"));
      authMonitorService.on(
        AuthEventType.DISCONNECTED,
        handleEvent("DISCONNECTED")
      );
      authMonitorService.on(
        AuthEventType.RECONNECTING,
        handleEvent("RECONNECTING")
      );
      authMonitorService.on(
        AuthEventType.FALLBACK_ACTIVATED,
        handleEvent("FALLBACK")
      );
      authMonitorService.on(
        AuthEventType.RECOVERY_FAILED,
        handleEvent("RECOVERY_FAILED")
      );
      authMonitorService.on(AuthEventType.OFFLINE_MODE, handleEvent("OFFLINE"));
      authMonitorService.on(
        AuthEventType.ONLINE_RESTORED,
        handleEvent("ONLINE")
      );
      authMonitorService.on(
        AuthEventType.TOKEN_REFRESHED,
        handleEvent("TOKEN_REFRESHED")
      );
      authMonitorService.on(
        AuthEventType.TOKEN_REFRESH_ERROR,
        handleEvent("TOKEN_REFRESH_ERROR")
      );

      // Add handler for leader election events
      authMonitorService.on(AuthEventType.LEADER_ELECTED, (data: any) => {
        setIsLeaderTab(data.isLeader);
        setLastEvent("LEADER_ELECTED");
        setLastEventTime(new Date().toLocaleTimeString());
        console.log(
          `Leader elected event: ${
            data.isLeader ? "This tab is leader" : "This tab is follower"
          }`,
          data
        );
      });

      // Check leader status periodically
      const leaderCheckInterval = setInterval(() => {
        try {
          const leaderData = localStorage.getItem(
            `auth_leader_tab_${deviceId}`
          );
          if (leaderData) {
            const data = JSON.parse(leaderData);

            // Ensure both values are strings for comparison
            const storedTabId = String(data.tabId || "");
            const currentTabId = String(tabId || "");

            // Compare as strings
            const isLeader = storedTabId === currentTabId;

            // Only update if changed and no modal is open
            console.log("Checking leader status change:", {
              isLeader,
              isLeaderTab,
              isAnyModalOpen,
            });

            // Force refresh the modal state from context
            const modalStateElement =
              document.getElementById("modal-state-debug");
            const currentModalState = modalStateElement
              ? modalStateElement.getAttribute("data-is-open") === "true"
              : false;

            // Also check for any visible modal elements as a fallback
            const visibleModals = document.querySelectorAll(
              '.modal-overlay:not([style*="display: none"])'
            );
            const hasVisibleModals = visibleModals.length > 0;

            console.log("Modal state check:", {
              contextValue: isAnyModalOpen,
              domValue: currentModalState,
              visibleModals: hasVisibleModals,
              modalCount: visibleModals.length,
            });

            // Use the most accurate modal state - any indication of an open modal should prevent leader changes
            const modalIsOpen =
              isAnyModalOpen || currentModalState || hasVisibleModals;

            console.log("Final modal state check:", {
              contextValue: isAnyModalOpen,
              domValue: currentModalState,
              visibleModals: hasVisibleModals,
              finalDecision: modalIsOpen,
            });

            if (isLeader !== isLeaderTab && !modalIsOpen) {
              console.log(
                `Leader status changed: ${isLeaderTab} -> ${isLeader}`
              );
              setIsLeaderTab(isLeader);
            } else if (isLeader !== isLeaderTab && modalIsOpen) {
              console.log(
                `Leader status change prevented due to open modal: ${isLeaderTab} -> ${isLeader}`
              );
            }

            // Check if leader data is stale (older than 30 seconds)
            const now = Date.now();
            const leaderTimestamp = data.timestamp || 0;
            const isStaleLeader = now - leaderTimestamp > 30000; // 30 seconds

            if (isStaleLeader && authMonitorService) {
              console.warn(
                "Detected stale leader in widget, forcing new election"
              );
              // Force new election
              if (
                typeof authMonitorService.forceLeaderElection === "function"
              ) {
                authMonitorService.forceLeaderElection();
              } else if (
                primusService &&
                typeof primusService.forceLeaderElection === "function"
              ) {
                primusService.forceLeaderElection();
              }
            }
          } else if (authMonitorService && !isLeaderTab) {
            // No leader exists, force election
            console.warn("No leader exists, forcing election from widget");
            if (typeof authMonitorService.forceLeaderElection === "function") {
              authMonitorService.forceLeaderElection();
            } else if (
              primusService &&
              typeof primusService.forceLeaderElection === "function"
            ) {
              primusService.forceLeaderElection();
            }
          }
        } catch (error) {
          console.error("Error checking leader status", error);
        }
      }, 1000); // Check more frequently

      // Get initial health status if modal is open
      if (open) {
        fetchStatus();
      }

      // Clean up
      return () => {
        authMonitorService.off(
          AuthEventType.STATUS_CHANGED,
          handleStatusChange
        );
        authMonitorService.off(
          AuthEventType.CONNECTED,
          handleEvent("CONNECTED")
        );
        authMonitorService.off(
          AuthEventType.DISCONNECTED,
          handleEvent("DISCONNECTED")
        );
        authMonitorService.off(
          AuthEventType.RECONNECTING,
          handleEvent("RECONNECTING")
        );
        authMonitorService.off(
          AuthEventType.FALLBACK_ACTIVATED,
          handleEvent("FALLBACK")
        );
        authMonitorService.off(
          AuthEventType.RECOVERY_FAILED,
          handleEvent("RECOVERY_FAILED")
        );
        authMonitorService.off(
          AuthEventType.OFFLINE_MODE,
          handleEvent("OFFLINE")
        );
        authMonitorService.off(
          AuthEventType.ONLINE_RESTORED,
          handleEvent("ONLINE")
        );
        authMonitorService.off(
          AuthEventType.TOKEN_REFRESHED,
          handleEvent("TOKEN_REFRESHED")
        );
        authMonitorService.off(
          AuthEventType.TOKEN_REFRESH_ERROR,
          handleEvent("TOKEN_REFRESH_ERROR")
        );

        clearInterval(leaderCheckInterval);
      };
    } catch (error) {
      console.error("Error initializing AuthMonitorWidget", error);
    }
  }, [tokenService, primusService, tabId, open]);

  // Get health status
  const fetchStatus = async () => {
    try {
      if (!tokenService || !primusService) {
        setHealthStatus({
          lastCheck: new Date(),
          tokenServiceHealthy: false,
          sessionServiceHealthy: false,
          webSocketServiceHealthy: false,
          errors: ["TokenService or PrimusService not available"],
        });
        return;
      }

      // Build health status object
      const status = {
        lastCheck: new Date(),
        tokenServiceHealthy:
          typeof tokenService.hasTokens === "function"
            ? tokenService.hasTokens()
            : false,
        sessionServiceHealthy: true,
        webSocketServiceHealthy:
          typeof primusService.isConnected === "function"
            ? primusService.isConnected()
            : false,
        lastTokenRefresh:
          typeof tokenService.getLastRefreshTime === "function"
            ? tokenService.getLastRefreshTime()
            : null,
        lastSessionSync: new Date(),
        tokenDetails: {
          isAccessTokenValid:
            typeof tokenService.hasAccessToken === "function"
              ? tokenService.hasAccessToken()
              : false,
          isRefreshTokenValid:
            typeof tokenService.hasRefreshToken === "function"
              ? tokenService.hasRefreshToken()
              : false,
          accessTokenExpiry: null,
          refreshTokenExpiry: null,
        },
        webSocketDetails: {
          connected:
            typeof primusService.isConnected === "function"
              ? primusService.isConnected()
              : false,
          socketId:
            typeof primusService.getSocketId === "function"
              ? primusService.getSocketId()
              : null,
          isLeader: isLeaderTab,
          rooms:
            typeof primusService.getRooms === "function"
              ? primusService.getRooms()
              : {},
        },
        sessionDetails: {
          activeSessions: 1,
          lastActivity: new Date(),
          currentDevice: {
            deviceId,
            tabId,
            isLeader: isLeaderTab,
          },
        },
        errors: [],
      };

      setHealthStatus(status);
    } catch (error) {
      console.error("Error fetching health status", error);
      setHealthStatus({
        lastCheck: new Date(),
        tokenServiceHealthy: false,
        sessionServiceHealthy: false,
        webSocketServiceHealthy: false,
        errors: [error.message || "Unknown error fetching health status"],
      });
    }
  };

  const handleRefresh = async () => {
    await fetchStatus();
  };

  const handleForceReconnect = () => {
    try {
      if (!tokenService || !primusService) {
        console.error("TokenService or PrimusService not available");
        return;
      }

      const authMonitorService = getAuthMonitorService(
        tokenService,
        primusService
      );
      authMonitorService.forceReconnect();
    } catch (error) {
      console.error("Error forcing reconnection", error);
    }
  };

  const handleForceFallback = () => {
    try {
      if (!tokenService || !primusService) {
        console.error("TokenService or PrimusService not available");
        return;
      }

      const authMonitorService = getAuthMonitorService(
        tokenService,
        primusService
      );
      authMonitorService.forceFallback();
    } catch (error) {
      console.error("Error forcing fallback mode", error);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  const getStatusColor = () => {
    switch (monitorStatus) {
      case AuthMonitorStatus.CONNECTED:
        return "#10b981"; // green
      case AuthMonitorStatus.RECONNECTING:
        return "#f59e0b"; // amber
      case AuthMonitorStatus.FALLBACK:
        return "#f59e0b"; // amber
      case AuthMonitorStatus.OFFLINE:
        return "#ef4444"; // red
      case AuthMonitorStatus.ERROR:
        return "#ef4444"; // red
      default:
        return "#3b82f6"; // blue
    }
  };

  const getStatusText = () => {
    switch (monitorStatus) {
      case AuthMonitorStatus.CONNECTED:
        return "Connected";
      case AuthMonitorStatus.RECONNECTING:
        return "Reconnecting";
      case AuthMonitorStatus.FALLBACK:
        return "Fallback Mode";
      case AuthMonitorStatus.OFFLINE:
        return "Offline";
      case AuthMonitorStatus.ERROR:
        return "Error";
      default:
        return "Initializing";
    }
  };

  // Simple styled components using inline styles
  const buttonStyle: React.CSSProperties = {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: 50,
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  const modalStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: open ? "flex" : "none",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  };

  const modalContentStyle: React.CSSProperties = {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    width: "90%",
    maxWidth: "800px",
    maxHeight: "90vh",
    overflow: "auto",
    padding: "20px",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  };

  const tabsStyle: React.CSSProperties = {
    display: "flex",
    borderBottom: "1px solid #e2e8f0",
    marginBottom: "16px",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    cursor: "pointer",
    borderBottom: active ? "2px solid #3b82f6" : "none",
    color: active ? "#3b82f6" : "#64748b",
    fontWeight: active ? "bold" : "normal",
  });

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
  };

  const badgeStyle = (success: boolean): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "9999px",
    fontSize: "12px",
    fontWeight: "bold",
    backgroundColor: success ? "#10b981" : "#ef4444",
    color: "#ffffff",
    marginLeft: "8px",
  });

  const [activeTab, setActiveTab] = useState("websocket");

  return (
    <>
      <button
        style={buttonStyle}
        onClick={() => setOpen(true)}
        aria-label="Auth Monitor"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </button>

      {open && (
        <div style={modalStyle} onClick={() => setOpen(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.5rem" }}>
                Authentication Monitor
              </h2>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: getStatusColor(),
                  }}
                ></span>
                <span style={{ fontSize: "0.875rem", fontWeight: "bold" }}>
                  {getStatusText()}
                </span>
                {lastEvent && (
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    Last event: {lastEvent} at {lastEventTime}
                  </span>
                )}
              </div>
            </div>

            {!healthStatus ? (
              <p>Loading health status...</p>
            ) : (
              <>
                <div style={tabsStyle}>
                  <div
                    style={tabStyle(activeTab === "token")}
                    onClick={() => setActiveTab("token")}
                  >
                    Token Service
                    <span style={badgeStyle(healthStatus.tokenServiceHealthy)}>
                      {healthStatus.tokenServiceHealthy ? "Healthy" : "Error"}
                    </span>
                  </div>
                  <div
                    style={tabStyle(activeTab === "session")}
                    onClick={() => setActiveTab("session")}
                  >
                    Session Service
                    <span
                      style={badgeStyle(healthStatus.sessionServiceHealthy)}
                    >
                      {healthStatus.sessionServiceHealthy ? "Healthy" : "Error"}
                    </span>
                  </div>
                  <div
                    style={tabStyle(activeTab === "websocket")}
                    onClick={() => setActiveTab("websocket")}
                  >
                    WebSocket Service
                    <span
                      style={badgeStyle(healthStatus.webSocketServiceHealthy)}
                    >
                      {healthStatus.webSocketServiceHealthy
                        ? "Healthy"
                        : "Error"}
                    </span>
                  </div>
                </div>

                {activeTab === "token" && (
                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0 }}>Token Information</h3>
                    <div style={{ marginBottom: "12px" }}>
                      <h4 style={{ margin: "8px 0", fontWeight: "medium" }}>
                        Last Token Refresh:
                      </h4>
                      <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                        {formatDate(healthStatus.lastTokenRefresh)}
                      </p>
                    </div>

                    {healthStatus.tokenDetails && (
                      <>
                        <div style={{ marginBottom: "12px" }}>
                          <h4 style={{ margin: "8px 0", fontWeight: "medium" }}>
                            Access Token:
                          </h4>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={badgeStyle(
                                healthStatus.tokenDetails.isAccessTokenValid
                              )}
                            >
                              {healthStatus.tokenDetails.isAccessTokenValid
                                ? "Valid"
                                : "Invalid"}
                            </span>
                            <p
                              style={{ fontSize: "0.875rem", color: "#64748b" }}
                            >
                              Expires:{" "}
                              {formatDate(
                                healthStatus.tokenDetails.accessTokenExpiry
                              )}
                            </p>
                          </div>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <h4 style={{ margin: "8px 0", fontWeight: "medium" }}>
                            Refresh Token:
                          </h4>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={badgeStyle(
                                healthStatus.tokenDetails.isRefreshTokenValid
                              )}
                            >
                              {healthStatus.tokenDetails.isRefreshTokenValid
                                ? "Valid"
                                : "Invalid"}
                            </span>
                            <p
                              style={{ fontSize: "0.875rem", color: "#64748b" }}
                            >
                              Expires:{" "}
                              {formatDate(
                                healthStatus.tokenDetails.refreshTokenExpiry
                              )}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "websocket" && (
                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0 }}>WebSocket Information</h3>
                    {healthStatus.webSocketDetails ? (
                      <>
                        <div style={{ marginBottom: "12px" }}>
                          <h4 style={{ margin: "8px 0", fontWeight: "medium" }}>
                            Connection Status:
                          </h4>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={badgeStyle(
                                healthStatus.webSocketDetails.connected
                              )}
                            >
                              {healthStatus.webSocketDetails.connected
                                ? "Connected"
                                : "Disconnected"}
                            </span>
                          </div>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <h4 style={{ margin: "8px 0", fontWeight: "medium" }}>
                            Socket ID:
                          </h4>
                          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                            {healthStatus.webSocketDetails.socketId || "N/A"}
                          </p>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <h4 style={{ margin: "8px 0", fontWeight: "medium" }}>
                            Leader Status:
                          </h4>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={badgeStyle(
                                healthStatus.webSocketDetails.isLeader
                              )}
                            >
                              {healthStatus.webSocketDetails.isLeader
                                ? "Leader Tab"
                                : "Follower Tab"}
                            </span>
                            <button
                              style={{
                                padding: "4px 8px",
                                backgroundColor: "#3b82f6",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                                marginRight: "4px",
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                // Debug leader status
                                try {
                                  console.log("--- LEADER STATUS DEBUG ---");
                                  console.log("Current tab ID:", tabId);
                                  console.log(
                                    "Is leader tab (state):",
                                    isLeaderTab
                                  );
                                  console.log(
                                    "Is leader tab (health):",
                                    healthStatus.webSocketDetails.isLeader
                                  );

                                  // Check localStorage
                                  const leaderData = localStorage.getItem(
                                    `auth_leader_tab_${deviceId}`
                                  );
                                  console.log(
                                    "Leader data in localStorage:",
                                    leaderData ? JSON.parse(leaderData) : null
                                  );

                                  if (leaderData) {
                                    const data = JSON.parse(leaderData);
                                    const match = data.tabId === tabId;
                                    console.log(
                                      `Tab ID comparison: ${data.tabId} === ${tabId} is ${match}`
                                    );

                                    // Character by character comparison
                                    console.log(
                                      "Character by character comparison:"
                                    );
                                    for (
                                      let i = 0;
                                      i <
                                      Math.max(
                                        data.tabId?.length || 0,
                                        tabId?.length || 0
                                      );
                                      i++
                                    ) {
                                      const eChar = data.tabId?.[i] || "";
                                      const tChar = tabId?.[i] || "";
                                      console.log(
                                        `Position ${i}: '${eChar}' (${
                                          eChar.charCodeAt(0) || "N/A"
                                        }) vs '${tChar}' (${
                                          tChar.charCodeAt(0) || "N/A"
                                        }) - ${
                                          eChar === tChar
                                            ? "Match"
                                            : "Different"
                                        }`
                                      );
                                    }
                                  }

                                  // Force update leader status
                                  if (leaderData) {
                                    const data = JSON.parse(leaderData);
                                    setIsLeaderTab(data.tabId === tabId);
                                    console.log(
                                      "Updated leader status:",
                                      data.tabId === tabId
                                    );
                                  }
                                } catch (error) {
                                  console.error(
                                    "Error debugging leader status:",
                                    error
                                  );
                                }
                              }}
                            >
                              Debug
                            </button>
                            <button
                              style={{
                                padding: "4px 8px",
                                backgroundColor: "#10b981",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                // Force this tab to be leader
                                try {
                                  console.log("--- FORCING LEADER STATUS ---");
                                  console.log("Current tab ID:", tabId);

                                  // Set this tab as leader in localStorage
                                  localStorage.setItem(
                                    `auth_leader_tab_${deviceId}`,
                                    JSON.stringify({
                                      tabId: tabId,
                                      timestamp: Date.now(),
                                    })
                                  );

                                  // Update state
                                  setIsLeaderTab(true);

                                  // Update health status
                                  if (
                                    healthStatus &&
                                    healthStatus.webSocketDetails
                                  ) {
                                    healthStatus.webSocketDetails.isLeader =
                                      true;
                                    setHealthStatus({ ...healthStatus });
                                  }

                                  console.log("This tab is now set as leader");

                                  // Notify PrimusAuthService if available
                                  if (
                                    primusService &&
                                    typeof primusService.emit === "function"
                                  ) {
                                    primusService.emit("leader:elected", {
                                      tabId: tabId,
                                      deviceId: deviceId,
                                      timestamp: Date.now(),
                                    });
                                    console.log(
                                      "Notified server about leader change"
                                    );
                                  }
                                } catch (error) {
                                  console.error(
                                    "Error forcing leader status:",
                                    error
                                  );
                                }
                              }}
                            >
                              Force Leader
                            </button>
                          </div>
                        </div>

                        {healthStatus.webSocketDetails.rooms && (
                          <div style={{ marginBottom: "12px" }}>
                            <h4
                              style={{ margin: "8px 0", fontWeight: "medium" }}
                            >
                              Joined Rooms:
                            </h4>
                            <pre
                              style={{
                                marginTop: "8px",
                                width: "100%",
                                borderRadius: "6px",
                                backgroundColor: "#0f172a",
                                padding: "16px",
                                color: "white",
                                overflow: "auto",
                              }}
                            >
                              <code>
                                {JSON.stringify(
                                  healthStatus.webSocketDetails.rooms,
                                  null,
                                  2
                                )}
                              </code>
                            </pre>
                          </div>
                        )}
                      </>
                    ) : (
                      <p>No WebSocket details available</p>
                    )}
                  </div>
                )}

                {activeTab === "session" && (
                  <div style={cardStyle}>
                    <h3 style={{ marginTop: 0 }}>Session Information</h3>
                    <div style={{ marginBottom: "12px" }}>
                      <h4 style={{ margin: "8px 0", fontWeight: "medium" }}>
                        Last Session Sync:
                      </h4>
                      <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                        {formatDate(healthStatus.lastSessionSync)}
                      </p>
                    </div>

                    {healthStatus.sessionDetails && (
                      <>
                        <div style={{ marginBottom: "12px" }}>
                          <h4 style={{ margin: "8px 0", fontWeight: "medium" }}>
                            Active Sessions:
                          </h4>
                          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                            {healthStatus.sessionDetails.activeSessions ||
                              "N/A"}
                          </p>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <h4 style={{ margin: "8px 0", fontWeight: "medium" }}>
                            Last Activity:
                          </h4>
                          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                            {formatDate(
                              healthStatus.sessionDetails.lastActivity
                            )}
                          </p>
                        </div>

                        {healthStatus.sessionDetails.currentDevice && (
                          <div style={{ marginBottom: "12px" }}>
                            <h4
                              style={{ margin: "8px 0", fontWeight: "medium" }}
                            >
                              Current Device:
                            </h4>
                            <pre
                              style={{
                                marginTop: "8px",
                                width: "100%",
                                borderRadius: "6px",
                                backgroundColor: "#0f172a",
                                padding: "16px",
                                color: "white",
                                overflow: "auto",
                              }}
                            >
                              <code>
                                {JSON.stringify(
                                  healthStatus.sessionDetails.currentDevice,
                                  null,
                                  2
                                )}
                              </code>
                            </pre>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {healthStatus?.errors && healthStatus.errors.length > 0 && (
              <div style={{ ...cardStyle, borderColor: "#ef4444" }}>
                <h3 style={{ marginTop: 0, color: "#ef4444" }}>Errors</h3>
                <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
                  {healthStatus.errors.map((error: string, index: number) => (
                    <li
                      key={index}
                      style={{ color: "#ef4444", marginBottom: "4px" }}
                    >
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: "16px",
              }}
            >
              <button
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                }}
                onClick={() => setOpen(false)}
              >
                Close
              </button>
              <button
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                }}
                onClick={handleForceReconnect}
              >
                Force Reconnect
              </button>
              <button
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                }}
                onClick={handleForceFallback}
              >
                Force Fallback
              </button>
              <button
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  cursor: "pointer",
                }}
                onClick={handleRefresh}
              >
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AuthMonitorWidget;
