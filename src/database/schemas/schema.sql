-- Intelligent Finder Database Schema

-- File metadata table
CREATE TABLE IF NOT EXISTS file_metadata (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    extension TEXT NOT NULL,
    size INTEGER NOT NULL,
    created TEXT NOT NULL,
    modified TEXT NOT NULL,
    accessed TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    encoding TEXT,
    checksum TEXT,
    indexed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Parsed content table
CREATE TABLE IF NOT EXISTS parsed_content (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    type TEXT NOT NULL,
    extracted_text TEXT,
    metadata TEXT, -- JSON
    pages INTEGER,
    sheets TEXT, -- JSON array
    parsed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES file_metadata(id) ON DELETE CASCADE
);

-- Workflow definitions
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    steps TEXT NOT NULL, -- JSON
    timeout INTEGER,
    retry_policy TEXT, -- JSON
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Workflow executions
CREATE TABLE IF NOT EXISTS workflow_executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL,
    current_step TEXT,
    results TEXT, -- JSON
    errors TEXT, -- JSON array
    start_time TEXT NOT NULL,
    end_time TEXT,
    FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id)
);

-- Operation queue
CREATE TABLE IF NOT EXISTS operation_queue (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    params TEXT NOT NULL, -- JSON
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    completed_at TEXT,
    error TEXT
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    operation TEXT NOT NULL,
    user_id TEXT,
    file_path TEXT NOT NULL,
    details TEXT, -- JSON
    result TEXT NOT NULL,
    error TEXT,
    duration INTEGER
);

-- Backups
CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    files TEXT NOT NULL, -- JSON array
    size INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    description TEXT,
    backup_path TEXT NOT NULL
);

-- Undo/Redo history
CREATE TABLE IF NOT EXISTS operation_history (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    state TEXT NOT NULL, -- 'executed' or 'undone'
    operation_data TEXT NOT NULL, -- JSON
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Search index (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    file_id,
    file_name,
    file_path,
    content,
    metadata,
    tokenize = 'porter'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_metadata_path ON file_metadata(path);
CREATE INDEX IF NOT EXISTS idx_file_metadata_extension ON file_metadata(extension);
CREATE INDEX IF NOT EXISTS idx_file_metadata_modified ON file_metadata(modified);
CREATE INDEX IF NOT EXISTS idx_parsed_content_file_id ON parsed_content(file_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_operation_queue_status ON operation_queue(status);
CREATE INDEX IF NOT EXISTS idx_operation_queue_priority ON operation_queue(priority);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);
