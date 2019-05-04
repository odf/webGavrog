port module GuiMain exposing (main)

import Bitwise
import Browser
import Browser.Dom as Dom
import Browser.Events
import Char
import Color
import ColorDialog
import DecodeScene exposing (MeshType(..), decodeScene)
import Dict exposing (Dict)
import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events
import Element.Font as Font
import Element.Input as Input
import Html.Events
import Json.Decode as Decode
import Json.Encode as Encode
import Materials exposing (netMaterial, paletteColor, tilingMaterial)
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import Menu
import Set exposing (Set)
import Styling
import Task
import ValueSlider
import View3d.Main as View3d exposing (Scene)
import View3d.Renderer exposing (Material)


main =
    Browser.document
        { init = init
        , update = update
        , view = view
        , subscriptions = subscriptions
        }


type InData
    = Title String
    | Log String
    | Scene DecodeScene.Scene Int Bool


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
    | OpenTiling2dDialog
    | OpenEmbeddingDialog
    | AboutDialog
    | AddTile
    | AddCorona
    | RestoreTile
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
    | UpdateTiling2dSettings Tiling2dSettings
    | UpdateEmbeddingSettings EmbeddingSettings
    | JSData Decode.Value
    | HideAbout
    | KeyUp String
    | RunAction Action
    | ContextMenuOnOff Position Buttons
    | MouseDown Position Buttons
    | Ignore


port toJS : Encode.Value -> Cmd msg


port fromJS : (Decode.Value -> msg) -> Sub msg


decodeKey : Decode.Decoder String
decodeKey =
    Decode.at [ "key" ] Decode.string


decodePos : Decode.Decoder Position
decodePos =
    Decode.map2 (\x y -> { x = toFloat x, y = toFloat y })
        (Decode.at [ "offsetX" ] Decode.int)
        (Decode.at [ "offsetY" ] Decode.int)


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


decodeInData : Decode.Decoder InData
decodeInData =
    Decode.oneOf
        [ Decode.map (\s -> Title s)
            (Decode.field "title" Decode.string)
        , Decode.map (\s -> Log s)
            (Decode.field "log" Decode.string)
        , Decode.map3 (\s d r -> Scene s d r)
            (Decode.field "scene" decodeScene)
            (Decode.field "dim" Decode.int)
            (Decode.field "reset" Decode.bool)
        ]



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
    | Tiling2dSettingsDialog
    | EmbeddingSettingsDialog


type alias DisplaySettings =
    { editBackgroundColor : Bool
    , backgroundColor : ColorDialog.Color
    , fadeToBackground : Float
    , fadeToBlue : Float
    , addOutlines : Bool
    , useSeparateOutlineColor : Bool
    , editOutlineColor : Bool
    , outlineColor : ColorDialog.Color
    , showSurfaceMesh : Bool
    }


type alias NetSettings =
    { vertexRadius : Float
    , editVertexColor : Bool
    , vertexColor : ColorDialog.Color
    , edgeRadius : Float
    , edgeColor : ColorDialog.Color
    , editEdgeColor : Bool
    }


type alias TilingSettings =
    { tileScale : Float
    , editEdgeColor : Bool
    , edgeColor : ColorDialog.Color
    , editTileBaseColor : Bool
    , tileBaseColor : ColorDialog.Color
    , drawEdges : Bool
    , colorByTranslationClass : Bool
    , extraSmooth : Bool
    , tighten : Bool
    , edgeWidth : Float
    }


type alias Tiling2dSettings =
    { tileScale : Float
    , editTileBaseColor : Bool
    , tileBaseColor : ColorDialog.Color
    , colorByTranslationClass : Bool
    , edgeWidth : Float
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
    , tiling2dSettings : Tiling2dSettings
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
            { editBackgroundColor = False
            , backgroundColor = Color.toHsla Color.white
            , showSurfaceMesh = False
            , fadeToBlue = 0.0
            , fadeToBackground = 0.0
            , addOutlines = False
            , useSeparateOutlineColor = False
            , editOutlineColor = False
            , outlineColor = Color.toHsla Color.white
            }
      , netSettings =
            { vertexRadius = 0.1
            , editVertexColor = False
            , vertexColor =
                { hue = 0.13
                , saturation = 0.7
                , lightness = 0.7
                , alpha = 1.0
                }
            , edgeRadius = 0.04
            , editEdgeColor = False
            , edgeColor =
                { hue = 0.63
                , saturation = 0.6
                , lightness = 0.6
                , alpha = 1.0
                }
            }
      , tilingSettings =
            { tileScale = 0.85
            , editEdgeColor = False
            , edgeColor =
                { hue = 0.0
                , saturation = 0.0
                , lightness = 1.0
                , alpha = 1.0
                }
            , editTileBaseColor = False
            , tileBaseColor =
                { hue = 0.5
                , saturation = 1.0
                , lightness = 0.7
                , alpha = 1.0
                }
            , drawEdges = False
            , colorByTranslationClass = False
            , extraSmooth = False
            , tighten = False
            , edgeWidth = 0.5
            }
      , tiling2dSettings =
            { tileScale = 1.0
            , editTileBaseColor = False
            , tileBaseColor =
                { hue = 0.5
                , saturation = 1.0
                , lightness = 0.7
                , alpha = 1.0
                }
            , colorByTranslationClass = False
            , edgeWidth = 0.5
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

        OpenTiling2dDialog ->
            "2D Tiling Settings..."

        OpenEmbeddingDialog ->
            "Embedding Settings..."

        AboutDialog ->
            "About Gavrog..."

        AddTile ->
            "Add Tile(s)"

        AddCorona ->
            "Add Corona(s)"

        RestoreTile ->
            "Restore Tile(s)"

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
    , makeMenuEntry OpenTiling2dDialog
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
    , makeMenuEntry RestoreTile
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


encodeColor : ColorDialog.Color -> Encode.Value
encodeColor { hue, saturation, lightness, alpha } =
    Encode.object
        [ ( "hue", Encode.float hue )
        , ( "saturation", Encode.float saturation )
        , ( "lightness", Encode.float lightness )
        , ( "alpha", Encode.float alpha )
        ]


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Resize width height ->
            ( updateView3d
                (View3d.setSize
                    { width = toFloat width, height = toFloat height - 100 }
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
                        toJS <|
                            Encode.object
                                [ ( "mode", Encode.string label )
                                , ( "text", Encode.string text )
                                ]

                    _ ->
                        Cmd.none

              else
                Cmd.none
            )

        UpdateDisplaySettings settings ->
            ( { model | displaySettings = settings }, Cmd.none )

        UpdateNetSettings settings ->
            if settings /= model.netSettings then
                let
                    options =
                        [ ( "netVertexRadius"
                          , Encode.float settings.vertexRadius
                          )
                        , ( "netEdgeRadius"
                          , Encode.float settings.edgeRadius
                          )
                        ]
                in
                ( { model | netSettings = settings }
                , toJS <|
                    Encode.object
                        [ ( "mode", Encode.string "options" )
                        , ( "options", Encode.object options )
                        ]
                )

            else
                ( { model | netSettings = settings }, Cmd.none )

        UpdateTilingSettings settings ->
            if settings /= model.tilingSettings then
                let
                    options =
                        [ ( "extraSmooth", Encode.bool settings.extraSmooth )
                        , ( "tightenSurfaces", Encode.bool settings.tighten )
                        , ( "tileScale", Encode.float settings.tileScale )
                        , ( "edgeWidth", Encode.float settings.edgeWidth )
                        ]
                in
                ( { model | tilingSettings = settings }
                , toJS <|
                    Encode.object
                        [ ( "mode", Encode.string "options" )
                        , ( "options", Encode.object options )
                        ]
                )

            else
                ( { model | tilingSettings = settings }, Cmd.none )

        UpdateTiling2dSettings settings ->
            if settings /= model.tiling2dSettings then
                let
                    options =
                        [ ( "tileScale2d", Encode.float settings.tileScale )
                        , ( "edgeWidth2d", Encode.float settings.edgeWidth )
                        ]
                in
                ( { model | tiling2dSettings = settings }
                , toJS <|
                    Encode.object
                        [ ( "mode", Encode.string "options" )
                        , ( "options", Encode.object options )
                        ]
                )

            else
                ( { model | tiling2dSettings = settings }, Cmd.none )

        UpdateEmbeddingSettings settings ->
            if settings /= model.embeddingSettings then
                let
                    options =
                        [ ( "skipRelaxation"
                          , Encode.bool settings.skipRelaxation
                          )
                        ]
                in
                ( { model | embeddingSettings = settings }
                , toJS <|
                    Encode.object
                        [ ( "mode", Encode.string "options" )
                        , ( "options", Encode.object options )
                        ]
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

        OpenTiling2dDialog ->
            ( { model | dialogStack = [ Tiling2dSettingsDialog ] }
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
            let
                { hue, saturation, lightness, alpha } =
                    model.displaySettings.backgroundColor

                colorAsText =
                    Color.hsla hue saturation lightness alpha
                        |> Color.toCssString

                options =
                    [ ( "backgroundColor", Encode.string colorAsText )
                    ]
            in
            ( updateView3d View3d.requestRedraw model
            , toJS <|
                Encode.object
                    [ ( "mode", Encode.string "menuChoice" )
                    , ( "text", Encode.string <| actionLabel action )
                    , ( "options", Encode.object options )
                    ]
            )

        _ ->
            let
                selected =
                    model.viewState.selected
                        |> Set.toList
                        |> List.map
                            (\( m, i ) ->
                                [ ( "meshIndex", Encode.int m )
                                , ( "instanceIndex", Encode.int i )
                                ]
                            )
            in
            ( model
            , toJS <|
                Encode.object
                    [ ( "mode", Encode.string "menuChoice" )
                    , ( "text", Encode.string <| actionLabel action )
                    , ( "selected", Encode.list Encode.object selected )
                    ]
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


makeMaterial : DecodeScene.Instance -> Int -> Model -> Material
makeMaterial { meshType, classIndex, latticeIndex } dim model =
    let
        tilingSettings =
            if dim == 2 then
                { colorByTranslationClass =
                    model.tiling2dSettings.colorByTranslationClass
                , drawEdges = False
                , edgeColor = model.tiling2dSettings.tileBaseColor
                , tileBaseColor = model.tiling2dSettings.tileBaseColor
                }

            else
                { colorByTranslationClass =
                    model.tilingSettings.colorByTranslationClass
                , drawEdges = model.tilingSettings.drawEdges
                , edgeColor = model.tilingSettings.edgeColor
                , tileBaseColor = model.tilingSettings.tileBaseColor
                }

        index =
            if tilingSettings.colorByTranslationClass then
                Maybe.withDefault 0 latticeIndex

            else
                Maybe.withDefault 0 classIndex

        tileColor =
            paletteColor tilingSettings.tileBaseColor index
    in
    case meshType of
        TileFace ->
            tilingMaterial tileColor

        TileEdges ->
            if tilingSettings.drawEdges then
                tilingMaterial tilingSettings.edgeColor

            else
                tilingMaterial tileColor

        NetEdge ->
            netMaterial model.netSettings.edgeColor

        NetVertex ->
            netMaterial model.netSettings.vertexColor

        Unknown ->
            tilingMaterial tilingSettings.tileBaseColor


convertScene : DecodeScene.Scene -> Int -> Model -> Scene
convertScene scene dim model =
    let
        convertInstance instance =
            { material = makeMaterial instance dim model
            , transform = instance.transform
            }
    in
    List.map
        (\{ mesh, instances } ->
            { mesh = mesh
            , instances = List.map convertInstance instances
            }
        )
        scene


handleJSData : Decode.Value -> Model -> Model
handleJSData value model =
    case Decode.decodeValue decodeInData value of
        Err e ->
            let
                dummy =
                    Debug.log "Error" (Decode.errorToString e)
            in
            model

        Ok data ->
            case data of
                Title text ->
                    { model | title = text }

                Log text ->
                    { model | status = text }

                Scene scene dim False ->
                    updateView3d
                        (View3d.setScene (convertScene scene dim model))
                        model

                Scene scene dim True ->
                    updateView3d
                        (View3d.setScene (convertScene scene dim model)
                            >> View3d.lookAlong (vec3 0 0 -1) (vec3 0 1 0)
                            >> View3d.encompass
                        )
                        model


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


convertColor : ColorDialog.Color -> Vec3
convertColor { hue, saturation, lightness, alpha } =
    let
        { red, green, blue } =
            Color.toRgba <| Color.hsla hue saturation lightness alpha
    in
    vec3 red green blue


view : Model -> Browser.Document Msg
view model =
    let
        settings =
            model.displaySettings

        { hue, saturation, lightness, alpha } =
            settings.backgroundColor

        bgColor =
            Color.hsla hue saturation lightness alpha

        outlineColor =
            if settings.useSeparateOutlineColor then
                settings.outlineColor

            else
                settings.backgroundColor

        options =
            { drawWires = settings.showSurfaceMesh
            , fadeToBackground = settings.fadeToBackground
            , fadeToBlue = settings.fadeToBlue
            , addOutlines = settings.addOutlines
            , outlineColor = convertColor outlineColor
            , backgroundColor = convertColor settings.backgroundColor
            }
    in
    { title = "Web-Gavrog"
    , body =
        [ Element.layout
            [ Element.width Element.fill
            , Font.size 16
            ]
            (Element.column
                [ Element.width Element.fill
                , Element.height Element.fill
                , Element.spacing 0
                , Element.inFront (viewContextMenu model)
                ]
                [ Element.el
                    [ Element.width Element.fill
                    , Element.below <| viewCurrentDialog model
                    ]
                    (viewHeader model)
                , Element.el
                    [ onContextMenu ContextMenuOnOff
                    , onMouseDown MouseDown
                    , Element.height Element.fill
                    ]
                    (Element.html <|
                        View3d.view ViewMsg model.viewState options bgColor
                    )
                , viewFooter model
                ]
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
        , Element.width Element.fill
        , Element.height <| Element.px 50
        , Element.centerX
        , Element.paddingXY 24 0
        ]
        (Element.row
            [ Element.width Element.fill
            , Element.spacing 24
            , Element.centerY
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
        , Element.width Element.fill
        , Element.height <| Element.px 50
        , Element.centerX
        , Element.paddingXY 24 0
        ]
        (Element.row
            [ Element.width Element.fill
            , Element.spacing 24
            , Element.centerY
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

        Tiling2dSettingsDialog :: _ ->
            wrap <|
                viewTiling2dSettings
                    UpdateTiling2dSettings
                    model.tiling2dSettings

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


viewColorInput :
    (ColorDialog.Color -> Msg)
    -> (Bool -> Msg)
    -> ColorDialog.Color
    -> Bool
    -> String
    -> Bool
    -> Element.Element Msg
viewColorInput colorToMsg activeToMsg color active label withAlpha =
    let
        colorField =
            Element.el
                [ Element.width <| Element.px 48
                , Element.height Element.fill
                , Border.solid
                , Border.width 1
                , Border.color <| Element.rgba 1.0 1.0 1.0 0.0
                , Border.shadow
                    { offset = ( 1.0, 2.0 )
                    , size = 1.0
                    , blur = 2.0
                    , color = Element.rgba 0.0 0.0 0.0 0.3
                    }
                ]
                (ColorDialog.colorField [ color ])

        colorDialog =
            if active then
                [ ColorDialog.view colorToMsg color withAlpha ]

            else
                []
    in
    Element.column
        [ Element.spacing 12 ]
        (Input.checkbox [ Element.height <| Element.px 24 ]
            { onChange = activeToMsg
            , icon = \_ -> colorField
            , checked = active
            , label =
                Input.labelRight
                    [ Element.centerY
                    , Element.moveRight 8
                    ]
                    (Element.text label)
            }
            :: colorDialog
        )


viewSeparator : Element.Element msg
viewSeparator =
    Element.el
        [ Element.width Element.fill
        , Element.height <| Element.px 1
        , Background.color Styling.borderColor
        ]
        Element.none


viewDisplaySettings :
    (DisplaySettings -> Msg)
    -> DisplaySettings
    -> Element.Element Msg
viewDisplaySettings toMsg settings =
    let
        outlineCheckbox =
            Input.checkbox []
                { onChange = \onOff -> toMsg { settings | addOutlines = onOff }
                , icon = Input.defaultCheckbox
                , checked = settings.addOutlines
                , label = Input.labelRight [] <| Element.text "Add Outlines"
                }

        outlineColorCheckbox =
            Input.checkbox []
                { onChange =
                    \onOff ->
                        toMsg { settings | useSeparateOutlineColor = onOff }
                , icon = Input.defaultCheckbox
                , checked = settings.useSeparateOutlineColor
                , label =
                    Input.labelRight [] <|
                        Element.text "Separate Outline Color"
                }

        outlineColorPicker =
            viewColorInput
                (\color -> toMsg { settings | outlineColor = color })
                (\onOff -> toMsg { settings | editOutlineColor = onOff })
                settings.outlineColor
                settings.editOutlineColor
                "Outline Color"
                False
    in
    Element.column
        [ Element.spacing 12 ]
        [ Element.row [ Element.width Element.fill ]
            [ Element.el
                [ Element.alignLeft
                , Element.Events.onClick (RunAction OpenEmbeddingDialog)
                , Element.pointer
                ]
                (Styling.makeIcon "◄")
            , Element.el [ Element.centerX, Font.bold, Element.paddingXY 16 0 ]
                (Element.text "Display Settings")
            , Element.el
                [ Element.alignRight
                , Element.Events.onClick (RunAction OpenNetDialog)
                , Element.pointer
                ]
                (Styling.makeIcon "►")
            ]
        , viewSeparator
        , viewColorInput
            (\color -> toMsg { settings | backgroundColor = color })
            (\onOff -> toMsg { settings | editBackgroundColor = onOff })
            settings.backgroundColor
            settings.editBackgroundColor
            "Background Color"
            True
        , viewSeparator
        , Element.column
            [ Element.spacing 12 ]
            (if settings.addOutlines then
                if settings.useSeparateOutlineColor then
                    [ outlineCheckbox
                    , outlineColorCheckbox
                    , outlineColorPicker
                    ]

                else
                    [ outlineCheckbox
                    , outlineColorCheckbox
                    ]

             else
                [ outlineCheckbox ]
            )
        , viewSeparator
        , Element.el []
            (Element.text "Fade To Background (Haze)")
        , ValueSlider.view
            (\value -> toMsg { settings | fadeToBackground = value })
            { widthPx = 200, heightPx = 18 }
            (Element.rgb 0.0 0.0 0.0)
            Nothing
            settings.fadeToBackground
        , Element.el []
            (Element.text "Fade To Blue (Color Perspective)")
        , ValueSlider.view
            (\value -> toMsg { settings | fadeToBlue = value })
            { widthPx = 200, heightPx = 18 }
            (Element.rgb 0.0 0.0 0.0)
            Nothing
            settings.fadeToBlue
        , viewSeparator
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
        [ Element.spacing 12 ]
        [ Element.row [ Element.width Element.fill ]
            [ Element.el
                [ Element.alignLeft
                , Element.Events.onClick (RunAction OpenDisplayDialog)
                , Element.pointer
                ]
                (Styling.makeIcon "◄")
            , Element.el [ Element.centerX, Font.bold, Element.paddingXY 16 0 ]
                (Element.text "Net Settings")
            , Element.el
                [ Element.alignRight
                , Element.Events.onClick (RunAction OpenTilingDialog)
                , Element.pointer
                ]
                (Styling.makeIcon "►")
            ]
        , viewSeparator
        , viewColorInput
            (\color -> toMsg { settings | vertexColor = color })
            (\onOff -> toMsg { settings | editVertexColor = onOff })
            settings.vertexColor
            settings.editVertexColor
            "Vertex Color"
            False
        , viewColorInput
            (\color -> toMsg { settings | edgeColor = color })
            (\onOff -> toMsg { settings | editEdgeColor = onOff })
            settings.edgeColor
            settings.editEdgeColor
            "Edge Color"
            False
        , viewSeparator
        , Element.el []
            (Element.text "Vertex Radius")
        , ValueSlider.view
            (\value -> toMsg { settings | vertexRadius = value })
            { widthPx = 200, heightPx = 18 }
            (Element.rgb 0.0 0.0 0.0)
            Nothing
            settings.vertexRadius
        , Element.el []
            (Element.text "Edge Radius")
        , ValueSlider.view
            (\value -> toMsg { settings | edgeRadius = value })
            { widthPx = 200, heightPx = 18 }
            (Element.rgb 0.0 0.0 0.0)
            Nothing
            settings.edgeRadius
        ]


viewTilingSettings :
    (TilingSettings -> Msg)
    -> TilingSettings
    -> Element.Element Msg
viewTilingSettings toMsg settings =
    Element.column
        [ Element.spacing 12 ]
        [ Element.row [ Element.width Element.fill ]
            [ Element.el
                [ Element.alignLeft
                , Element.Events.onClick (RunAction OpenNetDialog)
                , Element.pointer
                ]
                (Styling.makeIcon "◄")
            , Element.el [ Element.centerX, Font.bold, Element.paddingXY 16 0 ]
                (Element.text "Tiling Settings")
            , Element.el
                [ Element.alignRight
                , Element.Events.onClick (RunAction OpenTiling2dDialog)
                , Element.pointer
                ]
                (Styling.makeIcon "►")
            ]
        , viewSeparator
        , Element.column [ Element.spacing 12 ]
            (Input.checkbox []
                { onChange = \onOff -> toMsg { settings | drawEdges = onOff }
                , icon = Input.defaultCheckbox
                , checked = settings.drawEdges
                , label = Input.labelRight [] <| Element.text "Draw Edges"
                }
                :: (if settings.drawEdges then
                        [ viewColorInput
                            (\color -> toMsg { settings | edgeColor = color })
                            (\onOff ->
                                toMsg { settings | editEdgeColor = onOff }
                            )
                            settings.edgeColor
                            settings.editEdgeColor
                            "Edge Color"
                            False
                        ]

                    else
                        []
                   )
            )
        , Element.el []
            (Element.text "Edge/Bevel Width")
        , ValueSlider.view
            (\value -> toMsg { settings | edgeWidth = value })
            { widthPx = 200, heightPx = 18 }
            (Element.rgb 0.0 0.0 0.0)
            Nothing
            settings.edgeWidth
        , viewSeparator
        , Element.el []
            (Element.text "Tile Scale")
        , ValueSlider.view
            (\value -> toMsg { settings | tileScale = value })
            { widthPx = 200, heightPx = 18 }
            (Element.rgb 0.0 0.0 0.0)
            Nothing
            settings.tileScale
        , viewSeparator
        , viewColorInput
            (\color -> toMsg { settings | tileBaseColor = color })
            (\onOff -> toMsg { settings | editTileBaseColor = onOff })
            settings.tileBaseColor
            settings.editTileBaseColor
            "Tile base Color"
            False
        , Input.checkbox []
            { onChange =
                \onOff -> toMsg { settings | colorByTranslationClass = onOff }
            , icon = Input.defaultCheckbox
            , checked = settings.colorByTranslationClass
            , label =
                Input.labelRight [] <|
                    Element.text "Color By Translation"
            }
        , viewSeparator
        , Input.checkbox []
            { onChange =
                \onOff -> toMsg { settings | extraSmooth = onOff }
            , icon = Input.defaultCheckbox
            , checked = settings.extraSmooth
            , label =
                Input.labelRight [] <|
                    Element.text "Extra Smooth Faces"
            }
        , Input.checkbox []
            { onChange =
                \onOff -> toMsg { settings | tighten = onOff }
            , icon = Input.defaultCheckbox
            , checked = settings.tighten
            , label =
                Input.labelRight [] <|
                    Element.text "Tighten Faces (experimental)"
            }
        ]


viewTiling2dSettings :
    (Tiling2dSettings -> Msg)
    -> Tiling2dSettings
    -> Element.Element Msg
viewTiling2dSettings toMsg settings =
    Element.column
        [ Element.spacing 12 ]
        [ Element.row [ Element.width Element.fill ]
            [ Element.el
                [ Element.alignLeft
                , Element.Events.onClick (RunAction OpenTilingDialog)
                , Element.pointer
                ]
                (Styling.makeIcon "◄")
            , Element.el [ Element.centerX, Font.bold, Element.paddingXY 16 0 ]
                (Element.text "2D Tiling Settings")
            , Element.el
                [ Element.alignRight
                , Element.Events.onClick (RunAction OpenEmbeddingDialog)
                , Element.pointer
                ]
                (Styling.makeIcon "►")
            ]
        , viewSeparator
        , Element.el []
            (Element.text "Edge/Bevel Width")
        , ValueSlider.view
            (\value -> toMsg { settings | edgeWidth = value })
            { widthPx = 200, heightPx = 18 }
            (Element.rgb 0.0 0.0 0.0)
            Nothing
            settings.edgeWidth
        , viewSeparator
        , Element.el []
            (Element.text "Tile Scale")
        , ValueSlider.view
            (\value -> toMsg { settings | tileScale = value })
            { widthPx = 200, heightPx = 18 }
            (Element.rgb 0.0 0.0 0.0)
            Nothing
            settings.tileScale
        , viewSeparator
        , viewColorInput
            (\color -> toMsg { settings | tileBaseColor = color })
            (\onOff -> toMsg { settings | editTileBaseColor = onOff })
            settings.tileBaseColor
            settings.editTileBaseColor
            "Tile base Color"
            False
        , Input.checkbox []
            { onChange =
                \onOff -> toMsg { settings | colorByTranslationClass = onOff }
            , icon = Input.defaultCheckbox
            , checked = settings.colorByTranslationClass
            , label =
                Input.labelRight [] <|
                    Element.text "Color By Translation"
            }
        ]


viewEmbeddingSettings :
    (EmbeddingSettings -> Msg)
    -> EmbeddingSettings
    -> Element.Element Msg
viewEmbeddingSettings toMsg settings =
    Element.column
        [ Element.spacing 12 ]
        [ Element.row [ Element.width Element.fill ]
            [ Element.el
                [ Element.alignLeft
                , Element.Events.onClick (RunAction OpenTiling2dDialog)
                , Element.pointer
                ]
                (Styling.makeIcon "◄")
            , Element.el [ Element.centerX, Font.bold, Element.paddingXY 16 0 ]
                (Element.text "Embedding Settings")
            , Element.el
                [ Element.alignRight
                , Element.Events.onClick (RunAction OpenDisplayDialog)
                , Element.pointer
                ]
                (Styling.makeIcon "►")
            ]
        , viewSeparator
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
