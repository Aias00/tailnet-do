package main

import (
	"context"
	"github.com/coder/websocket"
	"syscall/js"
)

func main() {
	js.Global().Set("fixtureSleep", js.FuncOf(func(js.Value, []js.Value) any {
		d := js.Global().Get("Promise").Call("withResolvers")
		go func() {
			c, _, err := websocket.Dial(context.Background(), "ws://fixture.invalid", nil)
			if err != nil {
				d.Get("reject").Invoke(err.Error())
				return
			}
			js.Global().Call("signalReady")
			_, _, err = c.Read(context.Background())
			if err == nil {
				d.Get("reject").Invoke("expected read error")
				return
			}
			d.Get("resolve").Invoke("AWAKE")
		}()
		return d.Get("promise")
	}))
	select {}
}
