package db_test

import (
	"testing"

	"github.com/danny/collab-editor/backend/internal/db"
)

func TestOpenAndUpsertUser(t *testing.T) {
	database, err := db.Open(t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	user, err := database.UpsertUser("alice")
	if err != nil {
		t.Fatal(err)
	}
	if user.Username != "alice" {
		t.Fatalf("username = %q", user.Username)
	}

	same, err := database.UpsertUser("alice")
	if err != nil {
		t.Fatal(err)
	}
	if same.ID != user.ID {
		t.Fatalf("expected same user id, got %q vs %q", same.ID, user.ID)
	}
}

func TestDocumentsCRUD(t *testing.T) {
	database, err := db.Open(t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	user, err := database.UpsertUser("bob")
	if err != nil {
		t.Fatal(err)
	}

	doc, err := database.CreateDocument(user.ID, "Notes")
	if err != nil {
		t.Fatal(err)
	}

	got, err := database.GetDocument(doc.ID)
	if err != nil || got == nil || got.Title != "Notes" {
		t.Fatalf("GetDocument: %+v err=%v", got, err)
	}

	ok, err := database.UserOwnsDocument(user.ID, doc.ID)
	if err != nil || !ok {
		t.Fatalf("UserOwnsDocument = %v err=%v", ok, err)
	}

	docs, err := database.ListDocumentsByOwner(user.ID)
	if err != nil || len(docs) != 1 {
		t.Fatalf("ListDocumentsByOwner = %+v err=%v", docs, err)
	}
}
