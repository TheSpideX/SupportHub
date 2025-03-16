#!/bin/bash

# Configuration
DB_PATH="/Users/kumarsatyam/Desktop/CRM/Database"
MONGOD_CONF="$DB_PATH/mongod.conf"
LOG_DIR="$DB_PATH/logs"
MONGO_LOG="$LOG_DIR/mongodb.log"
REDIS_LOG="$LOG_DIR/redis.log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to check if a service is running
check_service_running() {
    local service_name="$1"
    pgrep "$service_name" > /dev/null
    return $?
}

# MongoDB Functions
start_mongo() {
    if check_service_running "mongod"; then
        echo "MongoDB is already running"
    else
        echo "Starting MongoDB..."
        mongod --config "$MONGOD_CONF" >> "$MONGO_LOG" 2>&1 &
        sleep 2
        if check_service_running "mongod"; then
            echo "MongoDB started successfully"
        else
            echo "Failed to start MongoDB. Check logs at: $MONGO_LOG"
            return 1
        fi
    fi
}

stop_mongo() {
    if check_service_running "mongod"; then
        echo "Stopping MongoDB..."
        MONGO_PID=$(pgrep mongod)
        kill "$MONGO_PID"
        sleep 2
        if ! check_service_running "mongod"; then
            echo "MongoDB stopped successfully"
        else
            echo "MongoDB didn't stop gracefully, forcing shutdown..."
            kill -9 "$MONGO_PID"
            sleep 1
            if ! check_service_running "mongod"; then
                echo "MongoDB stopped successfully"
            else
                echo "Failed to stop MongoDB"
                return 1
            fi
        fi
    else
        echo "MongoDB is not running"
    fi
}

# Redis Functions
start_redis() {
    if check_service_running "redis-server"; then
        echo "Redis is already running"
    else
        echo "Starting Redis..."
        redis-server >> "$REDIS_LOG" 2>&1 &
        sleep 2
        if check_service_running "redis-server"; then
            echo "Redis started successfully"
        else
            echo "Failed to start Redis. Check logs at: $REDIS_LOG"
            return 1
        fi
    fi
}

stop_redis() {
    if check_service_running "redis-server"; then
        echo "Stopping Redis..."
        REDIS_PID=$(pgrep redis-server)
        redis-cli shutdown
        sleep 2
        if ! check_service_running "redis-server"; then
            echo "Redis stopped successfully"
        else
            echo "Redis didn't stop gracefully, forcing shutdown..."
            kill -9 "$REDIS_PID"
            sleep 1
            if ! check_service_running "redis-server"; then
                echo "Redis stopped successfully"
            else
                echo "Failed to stop Redis"
                return 1
            fi
        fi
    else
        echo "Redis is not running"
    fi
}

# Backend Server Functions
start_backend() {
    echo "Starting Backend server..."
    npm start >> "$LOG_DIR/backend.log" 2>&1 &
    echo "Backend server started. Check logs at: $LOG_DIR/backend.log"
}

stop_backend() {
    if pgrep -f "node.*server.js" > /dev/null; then
        echo "Stopping Backend server..."
        pkill -f "node.*server.js"
        echo "Backend server stopped"
    else
        echo "Backend server is not running"
    fi
}

# Combined Functions
start_all() {
    echo "Starting all services..."
    start_mongo
    start_redis
    start_backend
    echo "All services started"
}

stop_all() {
    echo "Stopping all services..."
    stop_backend
    stop_redis
    stop_mongo
    echo "All services stopped"
}

status_all() {
    echo "=== Services Status ==="
    
    if check_service_running "mongod"; then
        echo "MongoDB: Running"
    else
        echo "MongoDB: Stopped"
    fi
    
    if check_service_running "redis-server"; then
        echo "Redis: Running"
    else
        echo "Redis: Stopped"
    fi
    
    if pgrep -f "node.*server.js" > /dev/null; then
        echo "Backend: Running"
    else
        echo "Backend: Stopped"
    fi
    
    echo "Log directory: $LOG_DIR"
}

# Command line interface
case "$1" in
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 2
        start_all
        ;;
    status)
        status_all
        ;;
    start-mongo)
        start_mongo
        ;;
    stop-mongo)
        stop_mongo
        ;;
    start-redis)
        start_redis
        ;;
    stop-redis)
        stop_redis
        ;;
    start-backend)
        start_backend
        ;;
    stop-backend)
        stop_backend
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|start-mongo|stop-mongo|start-redis|stop-redis|start-backend|stop-backend}"
        exit 1
        ;;
esac

exit 0