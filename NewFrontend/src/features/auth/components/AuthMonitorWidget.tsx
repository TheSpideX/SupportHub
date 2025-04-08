import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { authMonitor } from "../services/AuthMonitor";

const AuthMonitorWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { auth } = useAuth();
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    // Get initial health status
    const fetchStatus = async () => {
      const status = authMonitor.getHealthStatus();
      setHealthStatus(status);
    };

    if (open) {
      fetchStatus();
    }
  }, [open]);

  const handleRefresh = async () => {
    // Use the public method directly from the imported authMonitor instance
    await authMonitor.checkServices();
    const status = authMonitor.getHealthStatus();
    setHealthStatus(status);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
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
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                Last check:{" "}
                {healthStatus ? formatDate(healthStatus.lastCheck) : "N/A"}
              </span>
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
