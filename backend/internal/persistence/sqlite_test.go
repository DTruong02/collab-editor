package persistence_test

import (
	"context"
	"testing"

	"github.com/danny/collab-editor/backend/internal/db"
	"github.com/danny/collab-editor/backend/internal/persistence"
	"github.com/reearth/ygo/crdt"
)

func TestSQLiteAdapterLoadStoreRoundTrip(t *testing.T) {
	database, err := db.Open(t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	adapter := persistence.NewSQLiteAdapter(database)

	loaded, err := adapter.LoadDoc("room-1")
	if err != nil {
		t.Fatal(err)
	}
	if loaded != nil {
		t.Fatalf("expected nil for empty room, got %d bytes", len(loaded))
	}

	doc := crdt.New()
	txt := doc.GetText("content")
	doc.Transact(func(txn *crdt.Transaction) {
		txt.Insert(txn, 0, "hello", nil)
	})
	update := doc.EncodeStateAsUpdate()
	if err := adapter.StoreUpdate("room-1", update); err != nil {
		t.Fatal(err)
	}

	loaded, err = adapter.LoadDoc("room-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(loaded) == 0 {
		t.Fatal("expected merged update bytes")
	}

	restored := crdt.New()
	if err := restored.ApplyUpdate(loaded); err != nil {
		t.Fatal(err)
	}
	if got := restored.GetText("content").ToString(); got != "hello" {
		t.Fatalf("text = %q", got)
	}
}

func TestSQLiteAdapterStoreUpdateContext(t *testing.T) {
	database, err := db.Open(t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	adapter := persistence.NewSQLiteAdapter(database)
	doc := crdt.New()
	txt := doc.GetText("content")
	doc.Transact(func(txn *crdt.Transaction) {
		txt.Insert(txn, 0, "x", nil)
	})
	update := doc.EncodeStateAsUpdate()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := adapter.StoreUpdateContext(ctx, "room-2", update); err == nil {
		t.Fatal("expected cancelled context error")
	}
}
