//go:build js && wasm

package main

import (
	"errors"
	"fmt"
	"sync"
	"syscall/js"
	"testing"
)

func TestPromiseResolution(t *testing.T) {
	value, err := await(promise(func() (any, error) { return "ready", nil }))
	if err != nil || value.String() != "ready" {
		t.Fatalf("resolution = %v, %v", value, err)
	}
	value, err = await(promise(func() (any, error) { return js.Undefined(), nil }))
	if err != nil || !value.IsUndefined() {
		t.Fatalf("undefined resolution = %v, %v", value, err)
	}
}

func TestPromiseRejection(t *testing.T) {
	_, err := await(promise(func() (any, error) { return nil, errors.New("dial failed") }))
	if err == nil || err.Error() != "Error: dial failed" {
		t.Fatalf("rejection = %v", err)
	}
}

func TestConcurrentPromiseCallbacks(t *testing.T) {
	var wg sync.WaitGroup
	for i := range 100 {
		wg.Go(func() {
			want := fmt.Sprint(i)
			value, err := await(promise(func() (any, error) { return want, nil }))
			if err != nil || value.String() != want {
				t.Errorf("resolution = %v, %v; want %q", value, err, want)
			}
		})
	}
	wg.Wait()
}
