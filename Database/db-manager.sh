#!/bin/bash

# Configuration paths
DB_PATH="/Users/kumarsatyam/Desktop/SupportHub/Database"
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
        
        # First attempt: Graceful shutdown using redis-cli
        redis-cli shutdown
        sleep 2
        
        # Check if still running
        if check_service_running "redis-server"; then
            echo "First shutdown attempt failed, trying SIGTERM..."
            REDIS_PID=$(pgrep redis-server)
            
            # Second attempt: Send SIGTERM
            kill -15 "$REDIS_PID" 2>/dev/null
            sleep 3
            
            # Check again
            if check_service_running "redis-server"; then
                echo "SIGTERM failed, trying redis-cli shutdown with force..."
                
                # Third attempt: Force shutdown through redis-cli
                redis-cli shutdown NOSAVE
                sleep 2
                
                # Final check before SIGKILL
                if check_service_running "redis-server"; then
                    echo "Force shutdown failed, using SIGKILL as last resort..."
                    kill -9 "$REDIS_PID" 2>/dev/null
                    sleep 1
                    
                    if check_service_running "redis-server"; then
                        echo "Failed to stop Redis"
                        return 1
                    fi
                fi
            fi
        fi
        
        echo "Redis stopped successfully"
    else
        echo "Redis is not running"
    fi
}

# Combined Functions
start_all() {
    echo "Starting all databases..."
    start_mongo
    start_redis
    echo "All databases started"
}

stop_all() {
    echo "Stopping all databases..."
    stop_redis
    stop_mongo
    echo "All databases stopped"
}

status_all() {
    echo "=== Database Status ==="
    
    if check_service_running "mongod"; then
        echo "MongoDB: Running"
        echo "MongoDB Log: $MONGO_LOG"
        echo "MongoDB Config: $MONGOD_CONF"
        echo "Data directory: $DB_PATH"
    else
        echo "MongoDB: Stopped"
    fi
    
    if check_service_running "redis-server"; then
        echo "Redis: Running"
        echo "Redis Log: $REDIS_LOG"
    else
        echo "Redis: Stopped"
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
    *)
        echo "Usage: $0 {start|stop|restart|status|start-mongo|stop-mongo|start-redis|stop-redis}"
        exit 1
        ;;
esac

exit 0
