port module GuiMain exposing (main)

import Bitwise
import Browser
import Browser.Dom as Dom
import Browser.Events
import Char
import Color
import ColorDialog
import Dict exposing (Dict)
import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events
import Element.Font as Font
import Element.Input as Input
import Html.Events
import Json.Decode as Decode
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import Menu
import Set exposing (Set)
import Styling
import Task
import ValueSlider
import View3d.Main as View3d
import View3d.Scene exposing (RawSceneSpec)


main =
    Browser.document
        { init = init
        , update = update
        , view = view
        , subscriptions = subscriptions
        }


type alias OutOption =
    { key : String
    , onOff : Bool
    , text : Maybe String
    , value : Maybe Float
    , color : Maybe ColorDialog.Color
    }


type alias OutData =
    { mode : String
    , text : Maybe String
    , options : List OutOption
    , selected : List { meshIndex : Int, instanceIndex : Int }
    }


type alias InData =
    { title : Maybe String
    , log : Maybe String
    , scene : Maybe RawSceneSpec
    , reset : Bool
    }


type ViewAxis
    = AxisX
    | AxisY
    | AxisZ
    | DiagXY
    | DiagXZ
    | DiagYZ
    | DiagXYZ


type Direction
    = Left
    | Right
    | Up
    | Down
    | Clockwise
    | CounterClockwise


type Action
    = EnterSubMenu String (Menu.Config Action)
    | LeaveSubMenu
    | OpenFile
    | SaveStructure
    | SaveScreenshot
    | FirstInFile
    | PreviousInFile
    | NextInFile
    | LastInFile
    | JumpDialog
    | SearchDialog
    | CenterScene
    | ViewAlong ViewAxis
    | OpenDisplayDialog
    | OpenNetDialog
    | OpenTilingDialog
    | OpenEmbeddingDialog
    | AboutDialog
    | AddTile
    | AddCorona
    | RemoveTile
    | RemoveElement
    | RotateView Direction Float


type Msg
    = Resize Int Int
    | ViewMsg View3d.Msg
    | MainMenuToggle
    | MenuUpdate (Menu.State Action) (Menu.Result Action)
    | TextDialogInput String
    | TextDialogSubmit String Bool
    | UpdateDisplaySettings DisplaySettings
    | UpdateNetSettings NetSettings
    | UpdateTilingSettings TilingSettings
    | UpdateEmbeddingSettings EmbeddingSettings
    | JSData InData
    | HideAbout
    | KeyUp String
    | RunAction Action
    | ContextMenuOnOff Position Buttons
    | MouseDown Position Buttons
    | Ignore


port toJS : OutData -> Cmd msg


port fromJS : (InData -> msg) -> Sub msg


decodeKey : Decode.Decoder String
decodeKey =
    Decode.at [ "key" ] Decode.string


decodePos : Decode.Decoder Position
decodePos =
    Decode.map2 (\x y -> { x = toFloat x, y = toFloat y })
        (Decode.at [ "clientX" ] Decode.int)
        (Decode.at [ "clientY" ] Decode.int)


decodeButtons : Decode.Decoder Buttons
decodeButtons =
    Decode.map
        (\val ->
            { left = Bitwise.and val 1 > 0
            , right = Bitwise.and val 2 > 0
            , middle = Bitwise.and val 4 > 0
            }
        )
        (Decode.at [ "buttons" ] Decode.int)



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    [ fromJS JSData
    , Browser.Events.onKeyUp (Decode.map KeyUp decodeKey)
    , View3d.subscriptions ViewMsg model.viewState
    , Browser.Events.onResize Resize
    ]
        |> Sub.batch



-- MODEL


type alias Position =
    { x : Float, y : Float }


type alias Buttons =
    { left : Bool, right : Bool, middle : Bool }


type alias Flags =
    { revision : String
    , timestamp : String
    }


type alias TextBoxConfig =
    { label : String
    , placeholder : String
    , onInput : String -> Msg
    , onSubmit : Bool -> Msg
    }


type Dialog
    = FixedMenu (Menu.Config Action) (Menu.State Action)
    | ContextMenu (Menu.Config Action) (Menu.State Action) Position
    | TextDialog TextBoxConfig String
    | About
    | DisplaySettingsDialog
    | NetSettingsDialog
    | TilingSettingsDialog
    | EmbeddingSettingsDialog


type alias DisplaySettings =
    { backgroundColor : ColorDialog.Color
    , showSurfaceMesh : Bool
    }


type alias NetSettings =
    { vertexRadius : Float
    , vertexColor : ColorDialog.Color
    , edgeRadius : Float
    , edgeColor : ColorDialog.Color
    }


type alias TilingSettings =
    { tileScale : Float
    , edgeColor : ColorDialog.Color
    , highlightEdges : Bool
    , colorByTranslationClass : Bool
    , extraSmooth : Bool
    }


type alias EmbeddingSettings =
    { skipRelaxation : Bool
    }


type alias Model =
    { viewState : View3d.Model
    , revision : String
    , timestamp : String
    , dialogStack : List Dialog
    , displaySettings : DisplaySettings
    , netSettings : NetSettings
    , tilingSettings : TilingSettings
    , embeddingSettings : EmbeddingSettings
    , title : String
    , status : String
    }


rotationAngle : Float
rotationAngle =
    degrees 5


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( { viewState = View3d.init
      , revision = flags.revision
      , timestamp = flags.timestamp
      , dialogStack = []
      , title = ""
      , status = "Welcome!"
      , displaySettings =
            { backgroundColor = Color.toHsla Color.white
            , showSurfaceMesh = False
            }
      , netSettings =
            { vertexRadius = 0.1
            , vertexColor =
                { hue = 0.13
                , saturation = 0.7
                , lightness = 0.7
                , alpha = 1.0
                }
            , edgeRadius = 0.04
            , edgeColor =
                { hue = 0.63
                , saturation = 0.6
                , lightness = 0.6
                , alpha = 1.0
                }
            }
      , tilingSettings =
            { tileScale = 0.85
            , edgeColor =
                { hue = 0.0
                , saturation = 0.0
                , lightness = 1.0
                , alpha = 1.0
                }
            , highlightEdges = False
            , colorByTranslationClass = False
            , extraSmooth = False
            }
      , embeddingSettings =
            { skipRelaxation = False
            }
      }
    , Task.perform
        (\v -> Resize (floor v.viewport.width) (floor v.viewport.height))
        Dom.getViewport
    )


actionLabel : Action -> String
actionLabel action =
    case action of
        EnterSubMenu label config ->
            label

        LeaveSubMenu ->
            "<"

        OpenFile ->
            "Open..."

        SaveStructure ->
            "Save Structure..."

        SaveScreenshot ->
            "Save Screenshot..."

        FirstInFile ->
            "First"

        PreviousInFile ->
            "Prev"

        NextInFile ->
            "Next"

        LastInFile ->
            "Last"

        JumpDialog ->
            "Jump..."

        SearchDialog ->
            "Search..."

        CenterScene ->
            "Center Scene"

        ViewAlong axis ->
            case axis of
                AxisX ->
                    "X Axis"

                AxisY ->
                    "Y Axis"

                AxisZ ->
                    "Z Axis"

                DiagYZ ->
                    "YZ Diagonal"

                DiagXZ ->
                    "XZ Diagonal"

                DiagXY ->
                    "XY Diagonal"

                DiagXYZ ->
                    "Space Diagonal"

        OpenDisplayDialog ->
            "Display Settings..."

        OpenNetDialog ->
            "Net Settings..."

        OpenTilingDialog ->
            "Tiling Settings..."

        OpenEmbeddingDialog ->
            "Embedding Settings..."

        AboutDialog ->
            "About Gavrog..."

        AddTile ->
            "Add Tile(s)"

        AddCorona ->
            "Add Corona(s)"

        RemoveTile ->
            "Remove Tile(s)"

        RemoveElement ->
            "Remove Element(s)"

        RotateView dir _ ->
            case dir of
                Left ->
                    "Rotate Left"

                Right ->
                    "Rotate Right"

                Up ->
                    "Rotate Up"

                Down ->
                    "Rotate Down"

                Clockwise ->
                    "Rotate Clockwise"

                CounterClockwise ->
                    "Rotate Counter-Clockwise"


actionHotKey : Action -> Maybe String
actionHotKey action =
    case action of
        EnterSubMenu _ _ ->
            Just ">"

        PreviousInFile ->
            Just "P"

        NextInFile ->
            Just "N"

        CenterScene ->
            Just "0"

        ViewAlong axis ->
            case axis of
                AxisX ->
                    Just "X"

                AxisY ->
                    Just "Y"

                AxisZ ->
                    Just "Z"

                DiagYZ ->
                    Just "A"

                DiagXZ ->
                    Just "B"

                DiagXY ->
                    Just "C"

                DiagXYZ ->
                    Just "D"

        RotateView dir _ ->
            case dir of
                Left ->
                    Just "←"

                Right ->
                    Just "→"

                Up ->
                    Just "↑"

                Down ->
                    Just "↓"

                CounterClockwise ->
                    Just ","

                Clockwise ->
                    Just "."

        _ ->
            Nothing


hotKeyActions : Dict String Action
hotKeyActions =
    Dict.fromList
        [ ( "0", CenterScene )
        , ( "n", NextInFile )
        , ( "N", NextInFile )
        , ( "p", PreviousInFile )
        , ( "P", PreviousInFile )
        , ( "x", ViewAlong AxisX )
        , ( "X", ViewAlong AxisX )
        , ( "y", ViewAlong AxisY )
        , ( "Y", ViewAlong AxisY )
        , ( "z", ViewAlong AxisZ )
        , ( "Z", ViewAlong AxisZ )
        , ( "a", ViewAlong DiagYZ )
        , ( "A", ViewAlong DiagYZ )
        , ( "b", ViewAlong DiagXZ )
        , ( "B", ViewAlong DiagYZ )
        , ( "c", ViewAlong DiagXY )
        , ( "C", ViewAlong DiagXY )
        , ( "d", ViewAlong DiagXYZ )
        , ( "D", ViewAlong DiagXYZ )
        , ( "ArrowUp", RotateView Up rotationAngle )
        , ( "ArrowDown", RotateView Down rotationAngle )
        , ( "ArrowLeft", RotateView Left rotationAngle )
        , ( "ArrowRight", RotateView Right rotationAngle )
        , ( ",", RotateView CounterClockwise rotationAngle )
        , ( ".", RotateView Clockwise rotationAngle )
        ]


makeMenuEntry : Action -> Menu.Entry Action
makeMenuEntry action =
    Menu.Choice
        { label = actionLabel action
        , hotKey = actionHotKey action
        , action = action
        }


mainMenuConfig : Menu.Config Action
mainMenuConfig =
    [ makeMenuEntry OpenFile
    , makeMenuEntry SaveStructure
    , makeMenuEntry SaveScreenshot
    , Menu.Separator
    , makeMenuEntry FirstInFile
    , makeMenuEntry PreviousInFile
    , makeMenuEntry NextInFile
    , makeMenuEntry LastInFile
    , makeMenuEntry JumpDialog
    , makeMenuEntry SearchDialog
    , Menu.Separator
    , makeMenuEntry <| EnterSubMenu "View" viewMenuConfig
    , makeMenuEntry <| EnterSubMenu "Selection" contextMenuConfig
    , Menu.Separator
    , makeMenuEntry OpenDisplayDialog
    , makeMenuEntry OpenNetDialog
    , makeMenuEntry OpenTilingDialog
    , makeMenuEntry OpenEmbeddingDialog
    , Menu.Separator
    , makeMenuEntry AboutDialog
    ]


viewMenuConfig : Menu.Config Action
viewMenuConfig =
    [ makeMenuEntry LeaveSubMenu
    , Menu.Separator
    , makeMenuEntry CenterScene
    , Menu.Separator
    , Menu.Header "View Along"
    , makeMenuEntry <| ViewAlong AxisX
    , makeMenuEntry <| ViewAlong AxisY
    , makeMenuEntry <| ViewAlong AxisZ
    , makeMenuEntry <| ViewAlong DiagYZ
    , makeMenuEntry <| ViewAlong DiagXZ
    , makeMenuEntry <| ViewAlong DiagXY
    , makeMenuEntry <| ViewAlong DiagXYZ
    , Menu.Separator
    , Menu.Header "Rotate"
    , makeMenuEntry <| RotateView Left rotationAngle
    , makeMenuEntry <| RotateView Right rotationAngle
    , makeMenuEntry <| RotateView Up rotationAngle
    , makeMenuEntry <| RotateView Down rotationAngle
    , makeMenuEntry <| RotateView CounterClockwise rotationAngle
    , makeMenuEntry <| RotateView Clockwise rotationAngle
    ]


contextMenuConfig : Menu.Config Action
contextMenuConfig =
    [ makeMenuEntry AddTile
    , makeMenuEntry AddCorona
    , makeMenuEntry RemoveTile
    , makeMenuEntry RemoveElement
    ]


jumpDialogConfig : TextBoxConfig
jumpDialogConfig =
    { label = "Jump to"
    , placeholder = "Number"
    , onInput = TextDialogInput
    , onSubmit = TextDialogSubmit "jump"
    }


searchDialogConfig : TextBoxConfig
searchDialogConfig =
    { label = "Search by name"
    , placeholder = "Regex"
    , onInput = TextDialogInput
    , onSubmit = TextDialogSubmit "search"
    }



-- UPDATE


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Resize width height ->
            ( updateView3d
                (View3d.setSize
                    { width = toFloat width, height = toFloat height }
                )
                model
            , Cmd.none
            )

        ViewMsg viewMsg ->
            let
                ( viewStateTmp, outcome ) =
                    View3d.update viewMsg model.viewState
            in
            ( { model | viewState = viewStateTmp }
                |> handleView3dOutcome outcome
            , Cmd.none
            )

        MainMenuToggle ->
            case model.dialogStack of
                (FixedMenu _ _) :: _ ->
                    ( { model | dialogStack = [] }, Cmd.none )

                _ ->
                    ( { model
                        | dialogStack = [ FixedMenu mainMenuConfig Menu.init ]
                      }
                    , Cmd.none
                    )

        MenuUpdate state result ->
            case result of
                Just (EnterSubMenu label config) ->
                    executeAction (EnterSubMenu label config) model

                Just LeaveSubMenu ->
                    executeAction LeaveSubMenu model

                Just action ->
                    executeAction action { model | dialogStack = [] }

                Nothing ->
                    updateMenu state model

        JSData data ->
            ( handleJSData data model, Cmd.none )

        HideAbout ->
            ( { model | dialogStack = [] }, Cmd.none )

        TextDialogInput text ->
            case model.dialogStack of
                (TextDialog config _) :: rest ->
                    ( { model | dialogStack = TextDialog config text :: rest }
                    , Cmd.none
                    )

                _ ->
                    ( model, Cmd.none )

        TextDialogSubmit label ok ->
            ( { model | dialogStack = [] }
            , if ok then
                case model.dialogStack of
                    (TextDialog _ text) :: rest ->
                        toJS <| OutData label (Just text) [] []

                    _ ->
                        Cmd.none

              else
                Cmd.none
            )

        UpdateDisplaySettings settings ->
            if
                settings.backgroundColor
                    /= model.displaySettings.backgroundColor
            then
                let
                    colorToText c =
                        Color.hsla c.hue c.saturation c.lightness c.alpha
                            |> Color.toCssString

                    option =
                        { key = "backgroundColor"
                        , onOff = True
                        , text = Just (colorToText settings.backgroundColor)
                        , value = Nothing
                        , color = Nothing
                        }
                in
                ( { model | displaySettings = settings }
                , toJS <| OutData "options" Nothing [ option ] []
                )

            else
                ( { model | displaySettings = settings }, Cmd.none )

        UpdateNetSettings settings ->
            if settings /= model.netSettings then
                let
                    options =
                        [ { key = "netVertexRadius"
                          , onOff = True
                          , text = Nothing
                          , value = Just settings.vertexRadius
                          , color = Nothing
                          }
                        , { key = "netVertexColor"
                          , onOff = True
                          , text = Nothing
                          , value = Nothing
                          , color = Just settings.vertexColor
                          }
                        , { key = "netEdgeRadius"
                          , onOff = True
                          , text = Nothing
                          , value = Just settings.edgeRadius
                          , color = Nothing
                          }
                        , { key = "netEdgeColor"
                          , onOff = True
                          , text = Nothing
                          , value = Nothing
                          , color = Just settings.edgeColor
                          }
                        ]
                in
                ( { model | netSettings = settings }
                , toJS <| OutData "options" Nothing options []
                )

            else
                ( { model | netSettings = settings }, Cmd.none )

        UpdateTilingSettings settings ->
            if settings /= model.tilingSettings then
                let
                    options =
                        [ { key = "colorByTranslationClass"
                          , onOff = settings.colorByTranslationClass
                          , text = Nothing
                          , value = Nothing
                          , color = Nothing
                          }
                        , { key = "tileEdgeColor"
                          , onOff = True
                          , text = Nothing
                          , value = Nothing
                          , color = Just settings.edgeColor
                          }
                        , { key = "highlightEdges"
                          , onOff = settings.highlightEdges
                          , text = Nothing
                          , value = Nothing
                          , color = Nothing
                          }
                        , { key = "extraSmooth"
                          , onOff = settings.extraSmooth
                          , text = Nothing
                          , value = Nothing
                          , color = Nothing
                          }
                        , { key = "tileScale"
                          , onOff = True
                          , text = Nothing
                          , value = Just settings.tileScale
                          , color = Nothing
                          }
                        ]
                in
                ( { model | tilingSettings = settings }
                , toJS <| OutData "options" Nothing options []
                )

            else
                ( { model | tilingSettings = settings }, Cmd.none )

        UpdateEmbeddingSettings settings ->
            if settings /= model.embeddingSettings then
                let
                    options =
                        [ { key = "skipRelaxation"
                          , onOff = settings.skipRelaxation
                          , text = Nothing
                          , value = Nothing
                          , color = Nothing
                          }
                        ]
                in
                ( { model | embeddingSettings = settings }
                , toJS <| OutData "options" Nothing options []
                )

            else
                ( { model | embeddingSettings = settings }, Cmd.none )

        KeyUp code ->
            handleKeyPress code model

        RunAction action ->
            executeAction action model

        ContextMenuOnOff pos buttons ->
            let
                maybePos =
                    if buttons.right && not (contextMenuOpen model) then
                        Just pos

                    else
                        Nothing
            in
            ( contextMenuOnOff model maybePos, Cmd.none )

        MouseDown pos buttons ->
            if not buttons.right && contextMenuOpen model then
                ( contextMenuOnOff model Nothing, Cmd.none )

            else
                ( model, Cmd.none )

        Ignore ->
            ( model, Cmd.none )


contextMenuOpen : Model -> Bool
contextMenuOpen model =
    case model.dialogStack of
        (ContextMenu _ _ _) :: _ ->
            True

        _ ->
            False


updateMenu : Menu.State Action -> Model -> ( Model, Cmd Msg )
updateMenu state model =
    let
        newDialogStack =
            case model.dialogStack of
                (FixedMenu config _) :: rest ->
                    FixedMenu config state :: rest

                (ContextMenu config _ pos) :: rest ->
                    ContextMenu config state pos :: rest

                _ ->
                    model.dialogStack
    in
    ( { model | dialogStack = newDialogStack }, Cmd.none )


updateView3d : (View3d.Model -> View3d.Model) -> Model -> Model
updateView3d fn model =
    { model | viewState = fn model.viewState }


handleView3dOutcome : View3d.Outcome -> Model -> Model
handleView3dOutcome outcome model =
    let
        oldSelection =
            model.viewState.selected

        newSelection =
            case outcome of
                View3d.None ->
                    oldSelection

                View3d.PickEmpty mods ->
                    if mods.ctrl || mods.shift then
                        oldSelection

                    else
                        Set.empty

                View3d.Pick mods { meshIndex, instanceIndex } ->
                    let
                        item =
                            ( meshIndex, instanceIndex )
                    in
                    if Set.member item oldSelection then
                        Set.remove item oldSelection

                    else if mods.alt || mods.ctrl || mods.shift then
                        Set.insert item oldSelection

                    else
                        Set.singleton item

        newDialogStack =
            if outcome == View3d.None then
                model.dialogStack

            else
                []
    in
    { model
        | viewState = View3d.setSelection newSelection model.viewState
        , dialogStack = newDialogStack
    }


executeAction : Action -> Model -> ( Model, Cmd Msg )
executeAction action model =
    case action of
        EnterSubMenu _ config ->
            ( { model
                | dialogStack = FixedMenu config Menu.init :: model.dialogStack
              }
            , Cmd.none
            )

        LeaveSubMenu ->
            case model.dialogStack of
                _ :: rest ->
                    ( { model | dialogStack = rest }, Cmd.none )

                _ ->
                    ( model, Cmd.none )

        AboutDialog ->
            ( { model | dialogStack = [ About ] }, Cmd.none )

        JumpDialog ->
            ( { model | dialogStack = [ TextDialog jumpDialogConfig "" ] }
            , Cmd.none
            )

        SearchDialog ->
            ( { model | dialogStack = [ TextDialog searchDialogConfig "" ] }
            , Cmd.none
            )

        OpenDisplayDialog ->
            ( { model | dialogStack = [ DisplaySettingsDialog ] }
            , Cmd.none
            )

        OpenNetDialog ->
            ( { model | dialogStack = [ NetSettingsDialog ] }
            , Cmd.none
            )

        OpenTilingDialog ->
            ( { model | dialogStack = [ TilingSettingsDialog ] }
            , Cmd.none
            )

        OpenEmbeddingDialog ->
            ( { model | dialogStack = [ EmbeddingSettingsDialog ] }
            , Cmd.none
            )

        CenterScene ->
            ( updateView3d View3d.encompass model, Cmd.none )

        RotateView dir angle ->
            case dir of
                Left ->
                    ( rotateBy (vec3 0 1 0) -angle model, Cmd.none )

                Right ->
                    ( rotateBy (vec3 0 1 0) angle model, Cmd.none )

                Up ->
                    ( rotateBy (vec3 1 0 0) -angle model, Cmd.none )

                Down ->
                    ( rotateBy (vec3 1 0 0) angle model, Cmd.none )

                Clockwise ->
                    ( rotateBy (vec3 0 0 1) -angle model, Cmd.none )

                CounterClockwise ->
                    ( rotateBy (vec3 0 0 1) angle model, Cmd.none )

        ViewAlong axis ->
            case axis of
                AxisX ->
                    ( lookAlong (vec3 -1 0 0) (vec3 0 1 0) model, Cmd.none )

                AxisY ->
                    ( lookAlong (vec3 0 -1 0) (vec3 0 0 -1) model, Cmd.none )

                AxisZ ->
                    ( lookAlong (vec3 0 0 -1) (vec3 0 1 0) model, Cmd.none )

                DiagYZ ->
                    ( lookAlong (vec3 0 -1 -1) (vec3 0 1 0) model, Cmd.none )

                DiagXZ ->
                    ( lookAlong (vec3 -1 0 -1) (vec3 0 1 0) model, Cmd.none )

                DiagXY ->
                    ( lookAlong (vec3 0 -1 -1) (vec3 0 1 0) model, Cmd.none )

                DiagXYZ ->
                    ( lookAlong (vec3 -1 -1 -1) (vec3 0 1 0) model, Cmd.none )

        SaveScreenshot ->
            ( updateView3d (View3d.setRedraws True) model
            , toJS <| OutData "menuChoice" (Just <| actionLabel action) [] []
            )

        _ ->
            ( model
            , model.viewState.selected
                |> Set.toList
                |> List.map (\( m, i ) -> { meshIndex = m, instanceIndex = i })
                |> OutData "menuChoice" (Just <| actionLabel action) []
                |> toJS
            )


handleMenuSelection : Action -> Model -> ( Model, Cmd Msg )
handleMenuSelection action model =
    executeAction action { model | dialogStack = [] }


contextMenuOnOff : Model -> Maybe Position -> Model
contextMenuOnOff model maybePos =
    case maybePos of
        Nothing ->
            { model | dialogStack = [] }

        Just pos ->
            { model
                | dialogStack = [ ContextMenu contextMenuConfig Menu.init pos ]
            }


handleJSData : InData -> Model -> Model
handleJSData data model =
    model
        |> (case data.title of
                Nothing ->
                    identity

                Just s ->
                    \m -> { m | title = s }
           )
        |> (case data.log of
                Nothing ->
                    identity

                Just s ->
                    \m -> { m | status = s }
           )
        |> (case data.scene of
                Nothing ->
                    identity

                Just s ->
                    updateView3d (View3d.setScene s)
           )
        |> (if data.reset then
                updateView3d
                    (View3d.lookAlong (vec3 0 0 -1) (vec3 0 1 0)
                        >> View3d.encompass
                    )

            else
                identity
           )


isHotKey : String -> Bool
isHotKey char =
    List.member char (Dict.keys hotKeyActions)


handleKeyPress : String -> Model -> ( Model, Cmd Msg )
handleKeyPress char model =
    case Dict.get char hotKeyActions of
        Just action ->
            executeAction action model

        Nothing ->
            ( model, Cmd.none )


lookAlong : Vec3 -> Vec3 -> Model -> Model
lookAlong axis up model =
    updateView3d (View3d.lookAlong axis up) model


rotateBy : Vec3 -> Float -> Model -> Model
rotateBy axis angle model =
    updateView3d (View3d.rotateBy axis angle) model



-- VIEW


view : Model -> Browser.Document Msg
view model =
    let
        withWires =
            model.displaySettings.showSurfaceMesh

        color =
            model.displaySettings.backgroundColor

        backgroundColor =
            Color.hsla
                color.hue
                color.saturation
                color.lightness
                color.alpha
    in
    { title = "Web-Gavrog"
    , body =
        [ Element.layout
            [ Element.width Element.fill
            , Font.size 16
            , Element.inFront
                (Element.el
                    [ Element.width Element.fill
                    , Element.below <| viewCurrentDialog model
                    ]
                    (viewHeader model)
                )
            , Element.inFront
                (Element.el
                    [ Element.width Element.fill
                    , Element.alignBottom
                    ]
                    (viewFooter model)
                )
            , Element.inFront (viewContextMenu model)
            ]
            (Element.el
                [ onContextMenu ContextMenuOnOff
                , onMouseDown MouseDown
                ]
                (View3d.view
                    ViewMsg
                    model.viewState
                    withWires
                    backgroundColor
                    |> Element.html
                )
            )
        ]
    }


viewHeader : Model -> Element.Element Msg
viewHeader model =
    Element.el
        [ Background.color Styling.backgroundColor
        , Border.solid
        , Border.widthEach { top = 0, bottom = 1, left = 0, right = 0 }
        , Border.color Styling.borderColor
        , Border.shadow
            { offset = ( 0.0, 2.0 )
            , size = 0.0
            , blur = 4.0
            , color = Element.rgba 0.0 0.0 0.0 0.1
            }
        , Element.width Element.fill
        , Element.centerX
        , Element.paddingXY 24 4
        ]
        (Element.row
            [ Element.width Element.fill
            , Element.spacing 24
            ]
            [ Element.row
                [ Element.width Element.fill
                , Element.height Element.fill
                , Element.spacing 24
                , Element.clip
                ]
                [ Element.image []
                    { src = "3dt.ico", description = "Gavrog Logo" }
                , Styling.logoText "Gavrog"
                , Element.el
                    [ Element.width Element.fill
                    , Element.moveDown 4
                    ]
                    (Element.text model.status)
                ]
            , Element.el
                [ Element.alignRight
                , Element.Events.onClick MainMenuToggle
                , Element.pointer
                ]
                (Styling.makeIcon "☰")
            ]
        )


viewFooter : Model -> Element.Element Msg
viewFooter model =
    Element.el
        [ Background.color Styling.backgroundColor
        , Border.solid
        , Border.widthEach { top = 1, bottom = 0, left = 0, right = 0 }
        , Border.color Styling.borderColor
        , Border.shadow
            { offset = ( 0.0, 0.0 )
            , size = 0.0
            , blur = 4.0
            , color = Element.rgba 0.0 0.0 0.0 0.1
            }
        , Element.width Element.fill
        , Element.centerX
        , Element.paddingXY 24 8
        ]
        (Element.row
            [ Element.width Element.fill
            , Element.spacing 24
            ]
            [ Element.el
                [ Element.width Element.fill
                , Element.height Element.fill
                , Element.clip
                ]
                (Element.el [ Element.centerY ]
                    (Element.text model.title)
                )
            , Element.row [ Element.alignRight ]
                [ Element.el
                    [ Element.Events.onClick (RunAction PreviousInFile)
                    , Element.pointer
                    ]
                    (Styling.makeIcon "◄")
                , Element.el
                    [ Element.Events.onClick (RunAction NextInFile)
                    , Element.pointer
                    ]
                    (Styling.makeIcon "►")
                ]
            ]
        )


viewContextMenu : Model -> Element.Element Msg
viewContextMenu model =
    case model.dialogStack of
        (ContextMenu config state { x, y }) :: _ ->
            Element.el
                [ Element.moveDown y
                , Element.moveRight x
                , onContextMenu ContextMenuOnOff
                ]
                (Menu.view MenuUpdate config state)

        _ ->
            Element.none


viewCurrentDialog : Model -> Element.Element Msg
viewCurrentDialog model =
    let
        wrap =
            Element.el
                [ Element.moveUp 4
                , Element.moveLeft 4
                , Element.alignRight
                , Element.padding 16
                , Background.color Styling.backgroundColor
                , Border.solid
                , Border.width 1
                , Border.color Styling.borderColor
                , Border.shadow
                    { offset = ( 0.0, 8.0 )
                    , size = 0.0
                    , blur = 16.0
                    , color = Element.rgba 0.0 0.0 0.0 0.2
                    }
                ]
    in
    case model.dialogStack of
        [] ->
            Element.none

        (ContextMenu _ _ _) :: _ ->
            Element.none

        (FixedMenu config state) :: _ ->
            Element.el
                [ Element.moveUp 4
                , Element.moveLeft 4
                , Element.alignRight
                ]
                (Menu.view MenuUpdate config state)

        About :: _ ->
            wrap <|
                viewAbout model

        (TextDialog config text) :: _ ->
            wrap <|
                viewTextBox config text

        DisplaySettingsDialog :: _ ->
            wrap <|
                viewDisplaySettings UpdateDisplaySettings model.displaySettings

        NetSettingsDialog :: _ ->
            wrap <|
                viewNetSettings UpdateNetSettings model.netSettings

        TilingSettingsDialog :: _ ->
            wrap <|
                viewTilingSettings UpdateTilingSettings model.tilingSettings

        EmbeddingSettingsDialog :: _ ->
            wrap <|
                viewEmbeddingSettings
                    UpdateEmbeddingSettings
                    model.embeddingSettings


viewAbout : Model -> Element.Element Msg
viewAbout model =
    Element.column
        [ Element.Events.onClick HideAbout
        , Element.spacing 8
        ]
        [ Element.row [ Element.spacing 16 ]
            [ Element.image [ Element.alignTop ]
                { src = "3dt.ico", description = "Gavrog Logo" }
            , Element.column [ Element.spacing 4 ]
                [ Styling.logoText "Web-Gavrog"
                , Element.text "by Olaf Delgado-Friedrichs 2019"
                , Element.text "The Australian National University"
                ]
            ]
        , Element.paragraph []
            [ Element.el [ Font.bold ] (Element.text "Version: ")
            , Element.text "0.1.0 alpha"
            ]
        , Element.paragraph []
            [ Element.el [ Font.bold ] (Element.text "Revision: ")
            , Element.text <| String.slice 0 7 model.revision
            ]
        , Element.paragraph []
            [ Element.el [ Font.bold ] (Element.text "Timestamp: ")
            , Element.text model.timestamp
            ]
        ]


viewTextBox : TextBoxConfig -> String -> Element.Element Msg
viewTextBox config text =
    Element.column [ Element.spacing 8 ]
        [ Input.text
            [ onKeyUp
                (\k ->
                    if k == "Enter" then
                        config.onSubmit True

                    else
                        Ignore
                )
            ]
            { onChange = config.onInput
            , text = text
            , placeholder =
                Just <|
                    Input.placeholder [] <|
                        Element.text config.placeholder
            , label = Input.labelAbove [] <| Element.text config.label
            }
        , Element.row [ Element.spacing 16, Element.centerX ]
            [ Styling.button (config.onSubmit True) "OK"
            , Styling.button (config.onSubmit False) "Cancel"
            ]
        ]


viewDisplaySettings :
    (DisplaySettings -> Msg)
    -> DisplaySettings
    -> Element.Element Msg
viewDisplaySettings toMsg settings =
    Element.column
        [ Element.spacing 16 ]
        [ Element.el [ Element.centerX, Font.bold ]
            (Element.text "Display Settings")
        , Element.el []
            (Element.text "Background Color")
        , ColorDialog.view
            (\color -> toMsg { settings | backgroundColor = color })
            settings.backgroundColor
            True
        , Input.checkbox []
            { onChange = \onOff -> toMsg { settings | showSurfaceMesh = onOff }
            , icon = Input.defaultCheckbox
            , checked = settings.showSurfaceMesh
            , label = Input.labelRight [] <| Element.text "Show Surface Mesh"
            }
        ]


viewNetSettings : (NetSettings -> Msg) -> NetSettings -> Element.Element Msg
viewNetSettings toMsg settings =
    Element.column
        [ Element.spacing 16 ]
        [ Element.el [ Element.centerX, Font.bold ]
            (Element.text "Net Settings")
        , Element.el []
            (Element.text "Vertex Radius")
        , ValueSlider.view
            (\value -> toMsg { settings | vertexRadius = value })
            { widthPx = 200, heightPx = 18 }
            (Element.rgb 0.0 0.0 0.0)
            Nothing
            settings.vertexRadius
        , Element.el []
            (Element.text "Vertex Color")
        , ColorDialog.view
            (\color -> toMsg { settings | vertexColor = color })
            settings.vertexColor
            False
        , Element.el []
            (Element.text "Edge Radius")
        , ValueSlider.view
            (\value -> toMsg { settings | edgeRadius = value })
            { widthPx = 200, heightPx = 18 }
            (Element.rgb 0.0 0.0 0.0)
            Nothing
            settings.edgeRadius
        , Element.el []
            (Element.text "Edge Color")
        , ColorDialog.view
            (\color -> toMsg { settings | edgeColor = color })
            settings.edgeColor
            False
        ]


viewTilingSettings :
    (TilingSettings -> Msg)
    -> TilingSettings
    -> Element.Element Msg
viewTilingSettings toMsg settings =
    Element.column
        [ Element.spacing 16 ]
        [ Element.el [ Element.centerX, Font.bold ]
            (Element.text "Tiling Settings")
        , Element.el []
            (Element.text "Tile Scale")
        , ValueSlider.view
            (\value -> toMsg { settings | tileScale = value })
            { widthPx = 200, heightPx = 18 }
            (Element.rgb 0.0 0.0 0.0)
            Nothing
            settings.tileScale
        , Element.el []
            (Element.text "Edge Color")
        , ColorDialog.view
            (\color -> toMsg { settings | edgeColor = color })
            settings.edgeColor
            False
        , Input.checkbox []
            { onChange =
                \onOff -> toMsg { settings | highlightEdges = onOff }
            , icon = Input.defaultCheckbox
            , checked = settings.highlightEdges
            , label =
                Input.labelRight [] <|
                    Element.text "Highlight Edges"
            }
        , Input.checkbox []
            { onChange =
                \onOff -> toMsg { settings | colorByTranslationClass = onOff }
            , icon = Input.defaultCheckbox
            , checked = settings.colorByTranslationClass
            , label =
                Input.labelRight [] <|
                    Element.text "Color By Translation"
            }
        , Input.checkbox []
            { onChange =
                \onOff -> toMsg { settings | extraSmooth = onOff }
            , icon = Input.defaultCheckbox
            , checked = settings.extraSmooth
            , label =
                Input.labelRight [] <|
                    Element.text "Extra Smooth Faces"
            }
        ]


viewEmbeddingSettings :
    (EmbeddingSettings -> Msg)
    -> EmbeddingSettings
    -> Element.Element Msg
viewEmbeddingSettings toMsg settings =
    Element.column
        [ Element.spacing 16 ]
        [ Element.el [ Element.centerX, Font.bold ]
            (Element.text "Embedding Settings")
        , Input.checkbox []
            { onChange =
                \onOff -> toMsg { settings | skipRelaxation = onOff }
            , icon = Input.defaultCheckbox
            , checked = settings.skipRelaxation
            , label =
                Input.labelRight [] <| Element.text "SkipRelaxation"
            }
        ]


onKeyUp : (String -> msg) -> Element.Attribute msg
onKeyUp toMsg =
    let
        toResult value =
            { message = toMsg value
            , stopPropagation = isHotKey value
            , preventDefault = isHotKey value
            }
    in
    Element.htmlAttribute <|
        Html.Events.custom
            "keyup"
            (Decode.map toResult decodeKey)


onMouseDown : (Position -> Buttons -> msg) -> Element.Attribute msg
onMouseDown toMsg =
    let
        toResult pos buttons =
            { message = toMsg pos buttons
            , stopPropagation = True
            , preventDefault = True
            }
    in
    Element.htmlAttribute <|
        Html.Events.custom
            "mousedown"
            (Decode.map2 toResult decodePos decodeButtons)


onContextMenu : (Position -> Buttons -> msg) -> Element.Attribute msg
onContextMenu toMsg =
    let
        toResult pos buttons =
            { message = toMsg pos buttons
            , stopPropagation = True
            , preventDefault = True
            }
    in
    Element.htmlAttribute <|
        Html.Events.custom
            "contextmenu"
            (Decode.map2 toResult decodePos decodeButtons)
