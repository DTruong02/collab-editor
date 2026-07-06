package persistence

import (
	"context"
	"fmt"
	"time"

	"github.com/danny/collab-editor/backend/internal/db"
	"github.com/reearth/ygo/crdt"
)

// SQLiteAdapter implements ygo's PersistenceAdapter backed by doc_updates.
type SQLiteAdapter struct {
	db *db.DB
}

// NewSQLiteAdapter returns a persistence adapter that appends CRDT updates to SQLite.
func NewSQLiteAdapter(database *db.DB) *SQLiteAdapter {
	return &SQLiteAdapter{db: database}
}

// LoadDoc returns the merged V1 update for room, or nil if no state exists.
func (a *SQLiteAdapter) LoadDoc(room string) ([]byte, error) {
	rows, err := a.db.SQL().Query(
		`SELECT update_blob FROM doc_updates WHERE room_id = ? ORDER BY id ASC`,
		room,
	)
	if err != nil {
		return nil, fmt.Errorf("load doc updates: %w", err)
	}
	defer rows.Close()

	var updates [][]byte
	for rows.Next() {
		var blob []byte
		if err := rows.Scan(&blob); err != nil {
			return nil, err
		}
		updates = append(updates, blob)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(updates) == 0 {
		return nil, nil
	}
	return crdt.MergeUpdatesV1(updates...)
}

// StoreUpdate appends an incremental V1 update for room.
func (a *SQLiteAdapter) StoreUpdate(room string, update []byte) error {
	return a.storeUpdate(context.Background(), room, update)
}

// StoreUpdateContext is the context-aware variant used during server shutdown.
func (a *SQLiteAdapter) StoreUpdateContext(ctx context.Context, room string, update []byte) error {
	return a.storeUpdate(ctx, room, update)
}

func (a *SQLiteAdapter) storeUpdate(ctx context.Context, room string, update []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	now := time.Now().UTC()
	_, err := a.db.SQL().ExecContext(ctx,
		`INSERT INTO doc_updates (room_id, update_blob, created_at) VALUES (?, ?, ?)`,
		room, update, now,
	)
	if err != nil {
		return fmt.Errorf("store update: %w", err)
	}

	// Best-effort metadata touch; ignore when room has no documents row (e.g. tests).
	_ = a.db.TouchDocumentUpdatedAt(room)
	return nil
}

