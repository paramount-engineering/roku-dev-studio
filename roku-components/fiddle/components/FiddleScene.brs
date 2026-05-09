' Auto-generated scaffolding for the Roku Dev Studio Fiddle channel.
' Hosts the source viewer + invokes the user's userFiddle() if defined.
'
' init() handles UI state only. _rdsFiddle_setUpApp() is invoked by
' source/main.brs via `scene.callFunc("_rdsFiddle_setUpApp", invalid)`
' AFTER screen.show(), so the scene is fully painted before user code runs.
' Running user code inside init() would block the render thread and delay
' the first frame.
'
' NOTE: user code is compiled into this component's script scope via the
' <script uri="pkg:/components/UserCode.brs"/> entry in FiddleScene.xml.
' That means user code must NOT define `sub init()` — it would collide with
' the `sub init()` defined below and break the channel at compile time. The
' host Fiddle window lints for this before sideload.
'
' All Fiddle-internal functions and `m.*` fields use the `_rdsFiddle_`
' prefix so they can never collide with anything the user writes. The only
' unprefixed names here are the three Roku-reserved entry points: `Main`
' (source/main.brs), `init` (this file), and `onKeyEvent` (this file).
sub init()
    try
        m.top.backgroundURI = ""
        m.top.backgroundColor = "0x0a0a12"
        m._rdsFiddle_codeLabel = m.top.findNode("codeLabel")
        m._rdsFiddle_scrollGroup = m.top.findNode("scrollGroup")
        m._rdsFiddle_scrollPos = m.top.findNode("scrollPos")
        m._rdsFiddle_hintLabel = m.top.findNode("hintLabel")
        m._rdsFiddle_visibleH = 830
        m._rdsFiddle_scrollStep = 60
        m._rdsFiddle_scrollY = 0
        m._rdsFiddle_scrollMaxY = 0
        m._rdsFiddle_programErrored = false
        m._rdsFiddle_runId = "{{RUN_ID}}"

        ' Mirror the editor's source onto the TV.
        source = ""
        try
            source = ReadAsciiFile("pkg:/components/UserCode.brs")
        catch readErr
            source = ""
        end try
        if source = invalid or source = "" then
            source = "[User source unavailable]"
        end if
        if m._rdsFiddle_codeLabel <> invalid then
            m._rdsFiddle_codeLabel.text = source
            m._rdsFiddle_codeLabel.translation = [0, 0]
        end if
        if m.top <> invalid then m.top.setFocus(true)
    catch initErr
        _rdsFiddle_LogException(initErr)
    end try
end sub

' Called from main.brs after screen.show(). At this point SceneGraph has
' laid out the scene, so Label.boundingRect() returns real dimensions and
' the user's code can run without blocking the first paint.
function _rdsFiddle_setUpApp(_param as dynamic) as void
    ' Measure the source label now that layout is complete. Guarded so a
    ' stray API oddity can't block user-code execution below.
    try
        if m._rdsFiddle_codeLabel <> invalid then
            rect = m._rdsFiddle_codeLabel.boundingRect()
            labelH = rect.height
            if labelH > m._rdsFiddle_visibleH then
                m._rdsFiddle_scrollMaxY = m._rdsFiddle_visibleH - labelH
            else
                m._rdsFiddle_scrollMaxY = 0
            end if
            _rdsFiddle_updateScrollIndicator()
        end if
    catch measureErr
        _rdsFiddle_LogException(measureErr)
    end try

    ' Run the user's code. try/catch surfaces runtime errors in the footer
    ' without tearing down the scene. `userFiddle` is the entry-point
    ' convention; if it isn't defined we just print a note and keep the
    ' viewer up.
    '
    ' We print the BEGIN sentinel twice with a short gap. On firmwares where
    ' the host's telnet bounce (triggered right after the sideload HTTPS
    ' response) completes slower than expected, the first print can land on
    ' the now-destroyed old client. The second print — after a brief pause —
    ' reaches the fresh client. The renderer opens its gate on the first
    ' matching BEGIN it sees and ignores duplicates, so double-printing is
    ' safe and invisible to the user in the common case.
    print "[FIDDLE_BEGIN:" + m._rdsFiddle_runId + "]"
    sleep(250)
    print "[FIDDLE_BEGIN:" + m._rdsFiddle_runId + "]"

    ' Record local start time so the host terminal can show the wall clock.
    ' `AsDateString`/`AsTimeString` format args aren't available on every
    ' firmware, so we use the portable numeric getters and format manually.
    ' Whole block is in a try/catch so a stray API oddity can't tear down
    ' the scene before userFiddle() even runs.
    startStamp = ""
    try
        startedAt = CreateObject("roDateTime")
        startedAt.ToLocalTime()
        startStamp = _rdsFiddle_FormatWallClock(startedAt)
    catch startErr
        startStamp = "(unavailable)"
    end try
    if startStamp <> "" then print "Started at " + startStamp

    ' Mark a high-resolution timer so we can report total execution time.
    ' Guard against the (unlikely) case that roTimespan isn't available.
    runTimer = invalid
    try
        runTimer = CreateObject("roTimespan")
        runTimer.Mark()
    catch timerErr
        runTimer = invalid
    end try

    if (GetInterface(userFiddle, "ifFunction") <> invalid) then
        try
            userFiddle()
        catch e
            ' e.message can be invalid on some firmwares — coerce to a
            ' printable string so concatenation below never throws.
            _rdsFiddle_LogException(e)
            m._rdsFiddle_programErrored = true
            if m._rdsFiddle_hintLabel <> invalid then
                m._rdsFiddle_hintLabel.text = "Program Error: Exception Thrown"
                m._rdsFiddle_hintLabel.color = "0xef4444ff"
            end if
        end try
    else
        print "(no sub userFiddle() defined — nothing to run)"
    end if

    ' Report elapsed wall time for userFiddle() (best-effort — if the
    ' Timespan object never initialised we skip the line rather than crash).
    if runTimer <> invalid then
        try
            elapsedMs = runTimer.TotalMilliseconds()
            print "Finished in " + elapsedMs.ToStr() + " ms"
        catch elapsedErr
            ' swallow — timing is cosmetic
        end try
    end if
    print "[FIDDLE_END:" + m._rdsFiddle_runId + "]"

    if m._rdsFiddle_hintLabel <> invalid and not m._rdsFiddle_programErrored then
        m._rdsFiddle_hintLabel.text = "Fiddle Run Completed   ·   Up / Down to scroll   ·   Logs stream to Roku Dev Studio"
        m._rdsFiddle_hintLabel.color = "0x10b981ff"
    end if
end function

' Format an roDateTime as `YYYY-MM-DD  HH:MM:SS` in local time using the
' portable numeric getters. Returns an empty string on any failure so the
' caller can safely concatenate it into a `print`.
function _rdsFiddle_FormatWallClock(dt as object) as string
    out = ""
    try
        if dt = invalid then return ""
        yr = dt.GetYear()
        mo = dt.GetMonth()
        dy = dt.GetDayOfMonth()
        hh = dt.GetHours()
        mm = dt.GetMinutes()
        ss = dt.GetSeconds()
        out = yr.ToStr() + "-" + _rdsFiddle_Fmt2(mo) + "-" + _rdsFiddle_Fmt2(dy)
        out = out + "  " + _rdsFiddle_Fmt2(hh) + ":" + _rdsFiddle_Fmt2(mm) + ":" + _rdsFiddle_Fmt2(ss)
    catch fmtErr
        out = ""
    end try
    return out
end function

function _rdsFiddle_Fmt2(n as integer) as string
    s = n.ToStr()
    if Len(s) < 2 then s = "0" + s
    return s
end function

sub _rdsFiddle_LogException(e as dynamic)
    excp = "<unknown error>"
    if (GetInterface(e, "ifAssociativeArray") <> invalid) then
        if e.message <> invalid then 
            excp = "[FIDDLE] Exception: " + e.message + chr(10) + _rdsFiddle_getStackTrace(e.backtrace)
        end if
    end if
    print excp
end sub

function _rdsFiddle_getStackTrace(trace as dynamic) as string
    stackTrace = ""
    if (GetInterface(trace, "ifArray") <> invalid) then
        try
            stackTraceArr = ["Stack Trace Start"]
            for each x in trace
                stackTraceArr.Push("  Stack Trace: File=" + x.filename.toStr() + ", Line=" + x.line_number.toStr() + ", Function=" + x.function.toStr() + "\n")
            end for
            stackTraceArr.Push("Stack Trace End")
            stackTrace = stackTraceArr.Join(chr(10))
        catch exception
            
        end try
    end if
    return stackTrace
end function

sub _rdsFiddle_updateScrollIndicator()
    try
        if m._rdsFiddle_scrollPos = invalid then return
        if m._rdsFiddle_scrollMaxY = 0 then
            m._rdsFiddle_scrollPos.text = ""
            return
        end if
        total = -m._rdsFiddle_scrollMaxY + m._rdsFiddle_visibleH
        seen = -m._rdsFiddle_scrollY + m._rdsFiddle_visibleH
        if seen > total then seen = total
        if total <= 0 then
            m._rdsFiddle_scrollPos.text = ""
            return
        end if
        pct = Int((seen / total) * 100)
        m._rdsFiddle_scrollPos.text = pct.ToStr() + "%"
    catch indErr
        ' swallow — scroll indicator is cosmetic
    end try
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    ' Swallow the back key so a stray press doesn't exit the app while the
    ' user is reviewing output. Long-press Home on the remote still exits.
    if key = "back" then return true
    try
        newY = m._rdsFiddle_scrollY
        if key = "up" then
            newY = m._rdsFiddle_scrollY + m._rdsFiddle_scrollStep
        else if key = "down" then
            newY = m._rdsFiddle_scrollY - m._rdsFiddle_scrollStep
        else if key = "fastforward" then
            newY = m._rdsFiddle_scrollY - 6 * m._rdsFiddle_scrollStep
        else if key = "rewind" then
            newY = m._rdsFiddle_scrollY + 6 * m._rdsFiddle_scrollStep
        else if key = "play" then
            newY = 0
        else
            return false
        end if
        if newY > 0 then newY = 0
        if newY < m._rdsFiddle_scrollMaxY then newY = m._rdsFiddle_scrollMaxY
        if newY = m._rdsFiddle_scrollY then return true
        m._rdsFiddle_scrollY = newY
        if m._rdsFiddle_codeLabel <> invalid then m._rdsFiddle_codeLabel.translation = [0, m._rdsFiddle_scrollY]
        _rdsFiddle_updateScrollIndicator()
        return true
    catch keyErr
        _rdsFiddle_LogException(keyErr)
        return false
    end try
end function
