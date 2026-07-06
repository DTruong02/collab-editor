package db

import (
	"database/sql"
	"embed"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaFS embed.FS

// DB wraps the SQLite connection and document/user queries.
type DB struct {
	sql *sql.DB
}

// User is a registered username identity.
type User struct {
	ID        string
	Username  string
	CreatedAt time.Time
}

// Document is document metadata; body lives in CRDT updates.
type Document struct {
	ID        string
	Title     string
	OwnerID   string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Open opens (or creates) the SQLite database at path and applies schema.
func Open(path string) (*DB, error) {
	sqlDB, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	sqlDB.SetMaxOpenConns(1)

	if err := migrate(sqlDB); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}

	return &DB{sql: sqlDB}, nil
}

func migrate(sqlDB *sql.DB) error {
	schema, err := schemaFS.ReadFile("schema.sql")
	if err != nil {
		return fmt.Errorf("read schema: %w", err)
	}
	if _, err := sqlDB.Exec(string(schema)); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	return nil
}

// Close closes the database connection.
func (db *DB) Close() error {
	return db.sql.Close()
}

// UpsertUser finds a user by username or creates one.
func (db *DB) UpsertUser(username string) (*User, error) {
	var existing User
	err := db.sql.QueryRow(
		`SELECT id, username, created_at FROM users WHERE username = ?`,
		username,
	).Scan(&existing.ID, &existing.Username, &existing.CreatedAt)
	if err == nil {
		return &existing, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}

	now := time.Now().UTC()
	user := User{
		ID:        uuid.NewString(),
		Username:  username,
		CreatedAt: now,
	}
	_, err = db.sql.Exec(
		`INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)`,
		user.ID, user.Username, user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByID returns a user by primary key.
func (db *DB) GetUserByID(id string) (*User, error) {
	var user User
	err := db.sql.QueryRow(
		`SELECT id, username, created_at FROM users WHERE id = ?`,
		id,
	).Scan(&user.ID, &user.Username, &user.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// ListDocumentsByOwner returns documents owned by the given user, newest first.
func (db *DB) ListDocumentsByOwner(ownerID string) ([]Document, error) {
	rows, err := db.sql.Query(
		`SELECT id, title, owner_id, created_at, updated_at
		 FROM documents WHERE owner_id = ? ORDER BY updated_at DESC`,
		ownerID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []Document
	for rows.Next() {
		var doc Document
		if err := rows.Scan(&doc.ID, &doc.Title, &doc.OwnerID, &doc.CreatedAt, &doc.UpdatedAt); err != nil {
			return nil, err
		}
		docs = append(docs, doc)
	}
	return docs, rows.Err()
}

// CreateDocument inserts a new document owned by ownerID.
func (db *DB) CreateDocument(ownerID, title string) (*Document, error) {
	now := time.Now().UTC()
	doc := Document{
		ID:        uuid.NewString(),
		Title:     title,
		OwnerID:   ownerID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	_, err := db.sql.Exec(
		`INSERT INTO documents (id, title, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		doc.ID, doc.Title, doc.OwnerID, doc.CreatedAt, doc.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

// GetDocument returns document metadata by id.
func (db *DB) GetDocument(id string) (*Document, error) {
	var doc Document
	err := db.sql.QueryRow(
		`SELECT id, title, owner_id, created_at, updated_at FROM documents WHERE id = ?`,
		id,
	).Scan(&doc.ID, &doc.Title, &doc.OwnerID, &doc.CreatedAt, &doc.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

// UserOwnsDocument reports whether userID owns the document with the given id.
func (db *DB) UserOwnsDocument(userID, documentID string) (bool, error) {
	var ownerID string
	err := db.sql.QueryRow(
		`SELECT owner_id FROM documents WHERE id = ?`,
		documentID,
	).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return ownerID == userID, nil
}

// TouchDocumentUpdatedAt sets updated_at to now for the given document id.
func (db *DB) TouchDocumentUpdatedAt(documentID string) error {
	_, err := db.sql.Exec(
		`UPDATE documents SET updated_at = ? WHERE id = ?`,
		time.Now().UTC(), documentID,
	)
	return err
}

// SQL returns the underlying *sql.DB for persistence adapter use.
func (db *DB) SQL() *sql.DB {
	return db.sql
}
