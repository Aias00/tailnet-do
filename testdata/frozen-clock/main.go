package main

import (
	"syscall/js"
	"time"
)

func main() {
	js.Global().Set("fixtureSleep", js.FuncOf(func(js.Value, []js.Value) any {
		deferred := js.Global().Get("Promise").Call("withResolvers")
		go func() {
			time.Sleep(25 * time.Millisecond)
			deferred.Get("resolve").Invoke("AWAKE")
		}()
		return deferred.Get("promise")
	}))
	select {}
}
