' Roku Dev Studio Showcase — entry point.
'
' The catalog fetch and the debug proxy's reachability test both run inside
' HelperTask (see components/HelperTask.brs) and report back via its
' observed `output` field, so this loop only has to watch for the screen
' closing.
sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    scene.callFunc("_rdsShowcase_start")

    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" then
            if msg.isScreenClosed() then return
        end if
    end while
end sub
