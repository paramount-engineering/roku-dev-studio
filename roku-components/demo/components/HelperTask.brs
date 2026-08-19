' Generic async worker Task — one `input`/`output` field pair, an
' operation-keyed dispatch, and a roMessagePort event loop. MainScene.brs
' writes an { operation, ... } assocarray to `input` and observes `output`
' for the result; this Task's own thread does the actual roUrlTransfer work
' so it never blocks the render thread.
'
' Handles one request at a time by design — a second `input` write while a
' request is still in flight comes back as a "busy" error on `output`
' instead of corrupting the in-flight one. Good enough for a demo channel
' where these calls are triggered one at a time (App Connector, user
' actions); a real multi-job queue would be the next step if that changes.

sub init()
    m.top.functionName = "ProcessQueue"
end sub

sub ProcessQueue()
    m.port = CreateObject("roMessagePort")
    m.top.observeField("input", m.port)
    m.pendingOperation = invalid

    while true
        msg = wait(0, m.port)
        msgType = type(msg)
        if msgType = "roSGNodeEvent" then
            HandleInput(msg.GetData())
        else if msgType = "roUrlEvent" then
            HandleUrlEvent(msg)
        end if
    end while
end sub

sub HandleInput(data as object)
    if data = invalid or data.operation = invalid then return

    if m.pendingOperation <> invalid then
        m.top.output = { operation: data.operation, success: false, error: "HelperTask is busy with another request" }
        return
    end if

    if data.operation = "FetchJson" or data.operation = "TestReachable" then
        m.pendingOperation = data
        m.transfer = CreateObject("roUrlTransfer")
        m.transfer.SetMessagePort(m.port)
        m.transfer.SetUrl(data.url)
        ok = m.transfer.AsyncGetToString()
        if not ok then
            op = m.pendingOperation
            m.pendingOperation = invalid
            m.top.output = { operation: op.operation, tag: op.tag, success: false, error: "Could not start request for " + data.url }
        end if

    else if data.operation = "PostJson" then
        m.pendingOperation = data
        m.transfer = CreateObject("roUrlTransfer")
        m.transfer.SetMessagePort(m.port)
        m.transfer.SetUrl(data.url)
        m.transfer.AddHeader("Content-Type", "application/json")
        ok = m.transfer.AsyncPostFromString(data.body)
        if not ok then
            op = m.pendingOperation
            m.pendingOperation = invalid
            m.top.output = { operation: op.operation, tag: op.tag, success: false, error: "Could not start POST to " + data.url }
        end if

    else
        m.top.output = { operation: data.operation, success: false, error: "Unknown operation: " + data.operation }
    end if
end sub

sub HandleUrlEvent(event as object)
    if m.pendingOperation = invalid then return
    op = m.pendingOperation
    m.pendingOperation = invalid
    code = event.GetResponseCode()

    if op.operation = "FetchJson" then
        if code = 200 then
            parsed = ParseJson(event.GetString())
            m.top.output = { operation: "FetchJson", tag: op.tag, success: parsed <> invalid, data: parsed, responseCode: code }
        else
            m.top.output = { operation: "FetchJson", tag: op.tag, success: false, responseCode: code }
        end if

    else if op.operation = "PostJson" then
        ok = (code >= 200 and code < 300)
        parsed = invalid
        if ok then parsed = ParseJson(event.GetString())
        m.top.output = { operation: "PostJson", tag: op.tag, success: ok, data: parsed, responseCode: code }

    else if op.operation = "TestReachable" then
        m.top.output = { operation: "TestReachable", success: true, reachable: code > 0, responseCode: code }
    end if
end sub
