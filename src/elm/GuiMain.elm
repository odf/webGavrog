port module GuiMain exposing (main)

import Bitwise
import Browser
import Browser.Dom as Dom
import Browser.Events
import Char
import Color
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
import Options
import Set exposing (Set)
import Styling
import Task
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


type Action
    = OpenFile
    | SaveStructure
    | SaveScreenshot
    | FirstInFile
    | PreviousInFile
    | NextInFile
    | LastInFile
    | JumpDialog
    | SearchDialog
    | CenterScene
    | ViewAlongX
    | ViewAlongY
    | ViewAlongZ
    | ViewAlongA
    | ViewAlongB
    | ViewAlongC
    | ViewAlongDiagonal
    | OptionsDialog
    | AboutDialog
    | AddTile
    | AddCorona
    | RemoveTile
    | RemoveElement


type Msg
    = Resize Int Int
    | ViewMsg View3d.Msg
    | MainMenuToggle
    | MenuUpdate (Menu.State Action) (Menu.Result Action)
    | JumpDialogInput String
    | JumpDialogSubmit Bool
    | SearchDialogInput String
    | SearchDialogSubmit Bool
    | OptionsUpdate (List Options.Spec) (Maybe Bool)
    | JSData InData
    | HideAbout
    | KeyUp Int
    | ContextMenuOnOff Position Buttons
    | MouseDown Position Buttons
    | Ignore


port toJS : OutData -> Cmd msg


port fromJS : (InData -> msg) -> Sub msg


decodeKey : Decode.Decoder Int
decodeKey =
    Decode.at [ "keyCode" ] Decode.int


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


type DialogType
    = Menu (Menu.State Action)
    | ContextMenu (Menu.State Action) Position
    | About
    | Jump
    | Search
    | Options


type alias Model =
    { viewState : View3d.Model
    , revision : String
    , timestamp : String
    , mainMenuConfig : Menu.Config Action
    , contextMenuConfig : Menu.Config Action
    , dialogStack : List DialogType
    , jumpDialogConfig : TextBoxConfig
    , jumpDialogContent : String
    , searchDialogConfig : TextBoxConfig
    , searchDialogContent : String
    , optionSpecs : List Options.Spec
    , optionSpecsPrevious : List Options.Spec
    , title : String
    , status : String
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( { viewState = View3d.init
      , revision = flags.revision
      , timestamp = flags.timestamp
      , mainMenuConfig = initMainMenuConfig
      , contextMenuConfig = initContextMenuConfig
      , dialogStack = []
      , title = ""
      , status = "Welcome!"
      , jumpDialogConfig = jumpDialogConfig
      , jumpDialogContent = ""
      , searchDialogConfig = searchDialogConfig
      , searchDialogContent = ""
      , optionSpecs = initOptionSpecs
      , optionSpecsPrevious = []
      }
    , Task.perform
        (\v -> Resize (floor v.viewport.width) (floor v.viewport.height))
        Dom.getViewport
    )


actionLabel : Action -> String
actionLabel action =
    case action of
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

        ViewAlongX ->
            "View Along X"

        ViewAlongY ->
            "View Along Y"

        ViewAlongZ ->
            "View Along Z"

        ViewAlongA ->
            "View Along A"

        ViewAlongB ->
            "View Along B"

        ViewAlongC ->
            "View Along C"

        ViewAlongDiagonal ->
            "View Along Diagonal"

        OptionsDialog ->
            "Options..."

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


actionHotKey : Action -> Maybe String
actionHotKey action =
    case action of
        PreviousInFile ->
            Just "P"

        NextInFile ->
            Just "N"

        CenterScene ->
            Just "0"

        ViewAlongX ->
            Just "X"

        ViewAlongY ->
            Just "Y"

        ViewAlongZ ->
            Just "Z"

        ViewAlongA ->
            Just "A"

        ViewAlongB ->
            Just "B"

        ViewAlongC ->
            Just "C"

        ViewAlongDiagonal ->
            Just "D"

        _ ->
            Nothing


hotKeyActions : Dict Char Action
hotKeyActions =
    Dict.fromList
        [ ( 'n', NextInFile )
        , ( 'p', PreviousInFile )
        , ( '0', CenterScene )
        , ( 'x', ViewAlongX )
        , ( 'y', ViewAlongY )
        , ( 'z', ViewAlongZ )
        , ( 'a', ViewAlongA )
        , ( 'b', ViewAlongB )
        , ( 'c', ViewAlongC )
        , ( 'd', ViewAlongDiagonal )
        ]


makeMenuEntry : Action -> Menu.Entry Action
makeMenuEntry action =
    Menu.Choice
        { label = actionLabel action
        , hotKey = actionHotKey action
        , action = action
        }


initMainMenuConfig : Menu.Config Action
initMainMenuConfig =
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
    , makeMenuEntry CenterScene
    , makeMenuEntry ViewAlongX
    , makeMenuEntry ViewAlongY
    , makeMenuEntry ViewAlongZ
    , Menu.Separator
    , makeMenuEntry OptionsDialog
    , Menu.Separator
    , makeMenuEntry AboutDialog
    ]


initContextMenuConfig : Menu.Config Action
initContextMenuConfig =
    [ makeMenuEntry AddTile
    , makeMenuEntry AddCorona
    , makeMenuEntry RemoveTile
    , makeMenuEntry RemoveElement
    ]


jumpDialogConfig : TextBoxConfig
jumpDialogConfig =
    { label = "Jump to"
    , placeholder = "Number"
    , onInput = JumpDialogInput
    , onSubmit = JumpDialogSubmit
    }


searchDialogConfig : TextBoxConfig
searchDialogConfig =
    { label = "Search by name"
    , placeholder = "Regex"
    , onInput = SearchDialogInput
    , onSubmit = SearchDialogSubmit
    }


initOptionSpecs : List Options.Spec
initOptionSpecs =
    [ { key = "colorByTranslationClass"
      , label = "Color By Translations"
      , value = Options.Toggle False
      }
    , { key = "highlightEdges"
      , label = "Highlight Edges"
      , value = Options.Toggle False
      }
    , { key = "closeTileGaps"
      , label = "Close Tile Gaps"
      , value = Options.Toggle False
      }
    , { key = "skipRelaxation"
      , label = "Skip Relaxation"
      , value = Options.Toggle False
      }
    , { key = "extraSmooth"
      , label = "Extra-Smooth Faces"
      , value = Options.Toggle False
      }
    , { key = "showSurfaceMesh"
      , label = "Show Surface Mesh"
      , value = Options.Toggle False
      }
    , { key = "netVertexRadius"
      , label = "Net Vertex Radius"
      , value = Options.Number 0.1
      }
    , { key = "netEdgeRadius"
      , label = "Net Edge Radius"
      , value = Options.Number 0.04
      }
    , { key = "backgroundColor"
      , label = "Background Color"
      , value = Options.white
      }
    ]



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
                (Menu _) :: _ ->
                    ( { model | dialogStack = [] }, Cmd.none )

                _ ->
                    ( { model | dialogStack = [ Menu Menu.init ] }, Cmd.none )

        MenuUpdate state result ->
            case result of
                Just { action } ->
                    executeAction action { model | dialogStack = [] }

                Nothing ->
                    updateMenu state model

        JSData data ->
            ( handleJSData data model, Cmd.none )

        HideAbout ->
            ( { model | dialogStack = [] }, Cmd.none )

        JumpDialogInput text ->
            ( { model | jumpDialogContent = text }, Cmd.none )

        JumpDialogSubmit ok ->
            ( { model | dialogStack = [] }
            , if ok then
                toJS <| OutData "jump" (Just model.jumpDialogContent) [] []

              else
                Cmd.none
            )

        SearchDialogInput text ->
            ( { model | searchDialogContent = text }, Cmd.none )

        SearchDialogSubmit ok ->
            ( { model | dialogStack = [] }
            , if ok then
                toJS <| OutData "search" (Just model.searchDialogContent) [] []

              else
                Cmd.none
            )

        OptionsUpdate specs result ->
            updateOptions model specs result

        KeyUp code ->
            handleKeyPress code model

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
        (ContextMenu _ _) :: _ ->
            True

        _ ->
            False


updateMenu : Menu.State Action -> Model -> ( Model, Cmd Msg )
updateMenu state model =
    let
        newDialogStack =
            case model.dialogStack of
                (Menu _) :: rest ->
                    Menu state :: rest

                (ContextMenu _ pos) :: rest ->
                    ContextMenu state pos :: rest

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

                View3d.PickEmpty { ctrl, shift } ->
                    if ctrl || shift then
                        oldSelection

                    else
                        Set.empty

                View3d.Pick { ctrl, shift } { meshIndex, instanceIndex } ->
                    let
                        item =
                            ( meshIndex, instanceIndex )
                    in
                    if Set.member item oldSelection then
                        Set.remove item oldSelection

                    else if ctrl || shift then
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
        AboutDialog ->
            ( { model | dialogStack = [ About ] }, Cmd.none )

        JumpDialog ->
            ( { model | dialogStack = [ Jump ] }, Cmd.none )

        SearchDialog ->
            ( { model | dialogStack = [ Search ] }, Cmd.none )

        OptionsDialog ->
            ( { model
                | dialogStack = [ Options ]
                , optionSpecsPrevious = model.optionSpecs
              }
            , Cmd.none
            )

        CenterScene ->
            ( updateView3d View3d.encompass model, Cmd.none )

        ViewAlongX ->
            ( lookAlong (vec3 -1 0 0) (vec3 0 1 0) model, Cmd.none )

        ViewAlongY ->
            ( lookAlong (vec3 0 -1 0) (vec3 0 0 -1) model, Cmd.none )

        ViewAlongZ ->
            ( lookAlong (vec3 0 0 -1) (vec3 0 1 0) model, Cmd.none )

        ViewAlongA ->
            ( lookAlong (vec3 0 -1 -1) (vec3 0 1 0) model, Cmd.none )

        ViewAlongB ->
            ( lookAlong (vec3 -1 0 -1) (vec3 0 1 0) model, Cmd.none )

        ViewAlongC ->
            ( lookAlong (vec3 0 -1 -1) (vec3 0 1 0) model, Cmd.none )

        ViewAlongDiagonal ->
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
            { model | dialogStack = [ ContextMenu Menu.init pos ] }


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


updateOptions : Model -> List Options.Spec -> Maybe Bool -> ( Model, Cmd Msg )
updateOptions model specs result =
    let
        asJS { key, label, value } =
            case value of
                Options.Toggle onOff ->
                    { key = key
                    , onOff = onOff
                    , text = Nothing
                    , value = Nothing
                    }

                Options.Color c ->
                    { key = key
                    , onOff = True
                    , text =
                        Color.hsla c.hue c.saturation c.lightness c.alpha
                            |> Color.toCssString
                            |> Just
                    , value = Nothing
                    }

                Options.Number val ->
                    { key = key
                    , onOff = True
                    , text = Nothing
                    , value = Just val
                    }

        newModel =
            case result of
                Nothing ->
                    { model | optionSpecs = specs }

                Just ok ->
                    if ok then
                        { model | dialogStack = [] }

                    else
                        { model
                            | dialogStack = []
                            , optionSpecs = model.optionSpecsPrevious
                        }

        oldJsOut =
            List.map asJS model.optionSpecs

        newJsOut =
            List.map asJS newModel.optionSpecs

        cmd =
            if oldJsOut /= newJsOut then
                toJS <| OutData "options" Nothing newJsOut []

            else
                Cmd.none
    in
    ( newModel, cmd )


isHotKey : Int -> Bool
isHotKey code =
    let
        char =
            Char.toLower <| Char.fromCode code
    in
    List.member char (Dict.keys hotKeyActions)


handleKeyPress : Int -> Model -> ( Model, Cmd Msg )
handleKeyPress code model =
    let
        char =
            Char.toLower <| Char.fromCode code
    in
    case Dict.get char hotKeyActions of
        Just action ->
            executeAction action model

        Nothing ->
            ( model, Cmd.none )


lookAlong : Vec3 -> Vec3 -> Model -> Model
lookAlong axis up model =
    updateView3d (View3d.lookAlong axis up) model



-- VIEW


view : Model -> Browser.Document Msg
view model =
    let
        withWires =
            model.optionSpecs
                |> List.map
                    (\{ key, value } ->
                        (key == "showSurfaceMesh")
                            && (value == Options.Toggle True)
                    )
                |> List.foldl (||) False

        getColor val =
            case val of
                Options.Color color ->
                    Color.hsla
                        color.hue
                        color.saturation
                        color.lightness
                        color.alpha

                _ ->
                    Color.white

        backgroundColor =
            model.optionSpecs
                |> List.filter (\{ key, value } -> key == "backgroundColor")
                |> List.map (.value >> getColor)
                |> List.head
                |> Maybe.withDefault Color.white
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
            { offset = ( 0.0, 4.0 )
            , size = 0.0
            , blur = 4.0
            , color = Element.rgba 0.0 0.0 0.0 0.1
            }
        , Element.width Element.fill
        , Element.centerX
        , Element.paddingXY 24 4
        ]
        (Element.wrappedRow
            [ Element.width Element.fill
            , Element.spacing 24
            ]
            [ Element.image []
                { src = "3dt.ico", description = "Gavrog Logo" }
            , Element.paragraph []
                [ Styling.logoText "Gavrog"
                , Element.text "        "
                , Element.text model.title
                , Element.text "        "
                , Element.text model.status
                ]
            , Element.el
                [ Element.alignRight
                , Element.Events.onClick MainMenuToggle
                , Element.pointer
                ]
                Styling.navIcon
            ]
        )


viewContextMenu : Model -> Element.Element Msg
viewContextMenu model =
    case model.dialogStack of
        (ContextMenu state { x, y }) :: _ ->
            Element.el
                [ Element.moveDown y
                , Element.moveRight x
                , onContextMenu ContextMenuOnOff
                ]
                (Menu.view MenuUpdate model.contextMenuConfig state)

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

        (ContextMenu _ _) :: _ ->
            Element.none

        (Menu state) :: _ ->
            Element.el
                [ Element.moveUp 4
                , Element.moveLeft 4
                , Element.alignRight
                ]
                (Menu.view MenuUpdate model.mainMenuConfig state)

        About :: _ ->
            wrap <|
                viewAbout model

        Jump :: _ ->
            wrap <|
                viewTextBox model.jumpDialogConfig model.jumpDialogContent

        Search :: _ ->
            wrap <|
                viewTextBox model.searchDialogConfig model.searchDialogContent

        Options :: _ ->
            wrap <|
                Options.view OptionsUpdate model.optionSpecs


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
            [ onKeyUp (\n -> Ignore) ]
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


onKeyUp : (Int -> msg) -> Element.Attribute msg
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
            (Decode.map toResult <| Decode.at [ "keyCode" ] Decode.int)


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
