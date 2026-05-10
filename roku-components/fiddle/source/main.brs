' Auto-generated shell for the Roku Dev Studio Fiddle channel.
' Bootstraps the SceneGraph scene; user code lives in components/UserCode.brs.
'
' IMPORTANT: we explicitly `callFunc("_rdsFiddle_setUpApp")` after
' screen.show() so the scene is fully painted BEFORE user code runs. Running
' user code inside the scene's init() blocks the render thread and delays
' the first frame until the user's code completes.
sub Main()
    try
        screen = CreateObject("roSGScreen")
        port = CreateObject("roMessagePort")
        screen.setMessagePort(port)
        scene = screen.CreateScene("FiddleScene")
        screen.show()

        ' Small hold before the first `[FIDDLE_BEGIN:…]` print so the host
        ' has a chance to reopen its telnet client on port 8085. Some Roku
        ' firmwares only stream BrightScript prints to a single telnet client
        ' at a time, and sideloading a channel can land the stream on a
        ' client that the host doesn't own — the host bounces the socket
        ' right after the /plugin_install HTTP response so it becomes the
        ' bound client. This sleep makes sure that bounce has completed
        ' before we emit BEGIN. 500 ms is comfortably longer than a LAN
        ' TCP reconnect (typically <100 ms) and invisible next to the
        ' channel-launch latency the user is already waiting on.
        sleep(500)

        ' Invoke the scene-level entry point on the render thread after the
        ' first paint. Wrapped so a misbehaving scene can't stop Main() from
        ' settling into the message-loop.
        try
            scene.callFunc("_rdsFiddle_setUpApp", invalid)
        catch setupErr
            print "[FIDDLE] _rdsFiddle_setUpApp error: "; setupErr.message
        end try

        while true
            try
                msg = wait(0, port)
                if type(msg) = "roSGScreenEvent" then
                    if msg.isScreenClosed() then
                        ' The Fiddle viewer scene was closed. Either the user pressed
                        ' Home/Back, or their code created another roSGScreen and
                        ' replaced our viewer. Fiddle is intended for snippets that
                        ' print to the debug console — not full channels that set up
                        ' their own scene graph. Remove any
                        ' `CreateObject("roSGScreen")` calls from your code to keep
                        ' the viewer alive after the run completes.
                        print "[FIDDLE] Scene closed — channel exiting."
                        print "[FIDDLE] If you didn't press Home, your code may have created another roSGScreen, which replaces the viewer."
                        return
                    end if
                end if
            catch loopErr
                ' Don't exit the channel on a transient message-loop error —
                ' just log and keep waiting for events.
                print "[FIDDLE] main-loop error: "; loopErr.message
            end try
        end while
    catch mainErr
        print "[FIDDLE] fatal Main() error: "; mainErr.message
    end try
end sub
