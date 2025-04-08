import React, { useState, useEffect } from "react";
import {
  runSocketDiagnostic,
  testMultipleConfigurations,
  checkNetworkConnectivity,
} from "../utils/socket-diagnostics";
import axios from "axios";
import { logger } from "../utils/logger";

const SocketDiagnosticPage: React.FC = () => {
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [networkStatus, setNetworkStatus] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customUrl, setCustomUrl] = useState<string>("http://localhost:4290");
  const [customNamespace, setCustomNamespace] = useState<string>("/auth");
  const [withCredentials, setWithCredentials] = useState<boolean>(true);
  const [transport, setTransport] = useState<string>("polling");
  const [httpTestResult, setHttpTestResult] = useState<any>(null);

  // Run network connectivity check on mount
  useEffect(() => {
    const checkNetwork = async () => {
      const result = await checkNetworkConnectivity();
      setNetworkStatus(result);
    };

    checkNetwork();
  }, []);

  // Run diagnostic test
  const runDiagnostic = async () => {
    setIsLoading(true);
    try {
      const result = await runSocketDiagnostic(customUrl, customNamespace, {
        transports: [transport],
        withCredentials,
      });
      setDiagnosticResults(result);
      logger.info("Diagnostic test completed", result);
    } catch (error) {
      logger.error("Error running diagnostic test", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Run multiple configuration tests
  const runMultipleTests = async () => {
    setIsLoading(true);
    try {
      const result = await testMultipleConfigurations();
      setDiagnosticResults(result);
      logger.info("Multiple configuration tests completed", result);
    } catch (error) {
      logger.error("Error running multiple tests", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Run direct HTTP test
  const runHttpTest = async () => {
    setIsLoading(true);
    try {
      // Test 1: Basic GET request
      const getResult = await axios.get("http://localhost:4290/socket.io/", {
        withCredentials: true,
      });

      // Test 2: OPTIONS request (CORS preflight)
      const optionsResult = await axios.options(
        "http://localhost:4290/socket.io/",
        {
          withCredentials: true,
        }
      );

      // Test 3: POST request (Socket.IO polling)
      const postResult = await axios.post(
        "http://localhost:4290/socket.io/?EIO=4&transport=polling",
        {},
        {
          withCredentials: true,
          headers: {
            "Content-Type": "text/plain;charset=UTF-8",
          },
        }
      );

      // Combine results
      const result = {
        get: {
          status: getResult.status,
          headers: getResult.headers,
          data: getResult.data,
        },
        options: {
          status: optionsResult.status,
          headers: optionsResult.headers,
        },
        post: {
          status: postResult.status,
          headers: postResult.headers,
          data: postResult.data,
        },
      };

      setHttpTestResult(result);
      logger.info("HTTP test completed", result);
    } catch (error) {
      logger.error("Error running HTTP test", error);
      setHttpTestResult({
        error: {
          message: error.message,
          code: error.code,
          response: error.response
            ? {
                status: error.response.status,
                headers: error.response.headers,
                data: error.response.data,
              }
            : null,
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Socket.IO Diagnostic Tool</h1>

      {/* Network Status */}
      <div className="mb-6 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-2">Network Connectivity</h2>
        {networkStatus === null ? (
          <p>Checking network connectivity...</p>
        ) : networkStatus ? (
          <p className="text-green-600">✅ Server is reachable</p>
        ) : (
          <p className="text-red-600">❌ Server is not reachable</p>
        )}
        <button
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => checkNetworkConnectivity().then(setNetworkStatus)}
        >
          Recheck Network
        </button>
      </div>

      {/* Custom Test Form */}
      <div className="mb-6 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-2">Custom Test</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Server URL</label>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block mb-1">Namespace</label>
            <input
              type="text"
              value={customNamespace}
              onChange={(e) => setCustomNamespace(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block mb-1">Transport</label>
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="polling">Polling</option>
              <option value="websocket">WebSocket</option>
            </select>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={withCredentials}
              onChange={(e) => setWithCredentials(e.target.checked)}
              className="mr-2"
              id="withCredentials"
            />
            <label htmlFor="withCredentials">With Credentials</label>
          </div>
        </div>
        <button
          className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 mr-2"
          onClick={runDiagnostic}
          disabled={isLoading}
        >
          {isLoading ? "Running..." : "Run Test"}
        </button>
      </div>

      {/* Multiple Tests */}
      <div className="mb-6 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-2">
          Try Multiple Configurations
        </h2>
        <p className="mb-2">
          This will test multiple Socket.IO configurations to find one that
          works.
        </p>
        <button
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          onClick={runMultipleTests}
          disabled={isLoading}
        >
          {isLoading ? "Testing..." : "Run Multiple Tests"}
        </button>
      </div>

      {/* Direct HTTP Test */}
      <div className="mb-6 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-2">Direct HTTP Test</h2>
        <p className="mb-2">
          This will test direct HTTP requests to the Socket.IO server.
        </p>
        <button
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          onClick={runHttpTest}
          disabled={isLoading}
        >
          {isLoading ? "Testing..." : "Run HTTP Test"}
        </button>
      </div>

      {/* Socket.IO Results */}
      {diagnosticResults && (
        <div className="p-4 border rounded mb-6">
          <h2 className="text-xl font-semibold mb-2">Socket.IO Test Results</h2>
          <div className="bg-gray-100 p-4 rounded overflow-auto">
            <pre>{JSON.stringify(diagnosticResults, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* HTTP Test Results */}
      {httpTestResult && (
        <div className="p-4 border rounded mb-6">
          <h2 className="text-xl font-semibold mb-2">HTTP Test Results</h2>
          <div className="bg-gray-100 p-4 rounded overflow-auto">
            <pre>{JSON.stringify(httpTestResult, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Cookie Information */}
      <div className="mt-6 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-2">Cookie Information</h2>
        <div className="bg-gray-100 p-4 rounded overflow-auto">
          <p>
            <strong>Cookie Count:</strong> {document.cookie.split(";").length}
          </p>
          <p>
            <strong>Has Cookies:</strong>{" "}
            {document.cookie.length > 0 ? "Yes" : "No"}
          </p>
          <p>
            <strong>Cookies:</strong>
          </p>
          <pre>{document.cookie}</pre>
        </div>
      </div>
    </div>
  );
};

export default SocketDiagnosticPage;
