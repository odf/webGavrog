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


type Msg
    = Resize Int Int
    | ViewMsg View3d.Msg
    | MainMenuActivate Bool
    | MainMenuSetItem (Maybe ( Int, String ))
    | ContextMenuSetItem (Maybe ( Int, String ))
    | Select
    | JumpDialogInput String
    | JumpDialogSubmit Bool
    | SearchDialogInput String
    | SearchDialogSubmit Bool
    | OptionsMsg (List Options.Spec) (Maybe Bool)
    | JSData InData
    | HideAbout
    | KeyUp Int
    | ContextMenu Position Buttons
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


type alias MenuState =
    { visible : Bool
    , active : Maybe Int
    }


type DialogType
    = About
    | Jump
    | Search
    | Options


type alias Model =
    { viewState : View3d.Model
    , revision : String
    , timestamp : String
    , mainMenuConfig : Menu.Config Msg
    , mainMenuState : MenuState
    , contextMenuConfig : Menu.Config Msg
    , contextMenuState : MenuState
    , contextMenuPosition : Position
    , activeMenuLabel : Maybe String
    , visibleDialog : Maybe DialogType
    , jumpDialogConfig : TextBoxConfig
    , jumpDialogContent : String
    , searchDialogConfig : TextBoxConfig
    , searchDialogContent : String
    , optionSpecs : List Options.Spec
    , optionSpecsTmp : List Options.Spec
    , title : String
    , status : String
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( { viewState = View3d.init
      , revision = flags.revision
      , timestamp = flags.timestamp
      , mainMenuConfig = initMainMenuConfig
      , mainMenuState = { visible = False, active = Nothing }
      , contextMenuConfig = initContextMenuConfig
      , contextMenuState = { visible = False, active = Nothing }
      , contextMenuPosition = { x = 0, y = 0 }
      , activeMenuLabel = Nothing
      , visibleDialog = Nothing
      , title = ""
      , status = "Welcome!"
      , jumpDialogConfig = jumpDialogConfig
      , jumpDialogContent = ""
      , searchDialogConfig = searchDialogConfig
      , searchDialogContent = ""
      , optionSpecs = initOptionSpecs
      , optionSpecsTmp = []
      }
    , Task.perform
        (\v -> Resize (floor v.viewport.width) (floor v.viewport.height))
        Dom.getViewport
    )


initMainMenuConfig : Menu.Config Msg
initMainMenuConfig =
    let
        items =
            [ "Open..."
            , "Save Structure..."
            , "Save Screenshot..."
            , "--"
            , "First"
            , "Prev"
            , "Next"
            , "Last"
            , "Jump..."
            , "Search..."
            , "--"
            , "Center"
            , "Along X"
            , "Along Y"
            , "Along Z"
            , "--"
            , "Options..."
            , "--"
            , "About Gavrog..."
            ]
    in
    { items = items
    , activateItem = MainMenuSetItem
    , selectCurrentItem = Select
    }


initContextMenuConfig : Menu.Config Msg
initContextMenuConfig =
    let
        items =
            [ "Add Tile(s)"
            , "Add Corona(s)"
            , "Remove Tile(s)"
            , "Remove Element(s)"
            ]
    in
    { items = items
    , activateItem = ContextMenuSetItem
    , selectCurrentItem = Select
    }


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

        MainMenuActivate onOff ->
            ( mainMenuOnOff model onOff, Cmd.none )

        MainMenuSetItem item ->
            ( mainMenuSetItem model item, Cmd.none )

        ContextMenuSetItem item ->
            ( contextMenuSetItem model item, Cmd.none )

        Select ->
            handleMenuSelection model

        JSData data ->
            ( handleJSData data model, Cmd.none )

        HideAbout ->
            ( { model | visibleDialog = Nothing }, Cmd.none )

        JumpDialogInput text ->
            ( { model | jumpDialogContent = text }, Cmd.none )

        JumpDialogSubmit ok ->
            ( { model | visibleDialog = Nothing }
            , if ok then
                toJS <| OutData "jump" (Just model.jumpDialogContent) [] []

              else
                Cmd.none
            )

        SearchDialogInput text ->
            ( { model | searchDialogContent = text }, Cmd.none )

        SearchDialogSubmit ok ->
            ( { model | visibleDialog = Nothing }
            , if ok then
                toJS <| OutData "search" (Just model.searchDialogContent) [] []

              else
                Cmd.none
            )

        OptionsMsg specs result ->
            updateOptions model specs result

        KeyUp code ->
            handleKeyPress code model

        ContextMenu pos buttons ->
            let
                maybePos =
                    if buttons.right && not model.contextMenuState.visible then
                        Just pos

                    else
                        Nothing
            in
            ( contextMenuOnOff model maybePos, Cmd.none )

        MouseDown pos buttons ->
            if not buttons.right && model.contextMenuState.visible then
                ( contextMenuOnOff model Nothing, Cmd.none )

            else
                ( model, Cmd.none )

        Ignore ->
            ( model, Cmd.none )


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
    in
    { model | viewState = View3d.setSelection newSelection model.viewState }


handleMenuSelection : Model -> ( Model, Cmd Msg )
handleMenuSelection model =
    let
        newModel =
            { model
                | mainMenuState = { visible = False, active = Nothing }
                , contextMenuState = { visible = False, active = Nothing }
            }
    in
    if model.activeMenuLabel == Just "About Gavrog..." then
        ( { newModel | visibleDialog = Just About }, Cmd.none )

    else if model.activeMenuLabel == Just "Jump..." then
        ( { newModel | visibleDialog = Just Jump }, Cmd.none )

    else if model.activeMenuLabel == Just "Search..." then
        ( { newModel | visibleDialog = Just Search }, Cmd.none )

    else if model.activeMenuLabel == Just "Options..." then
        ( { newModel
            | visibleDialog = Just Options
            , optionSpecsTmp = model.optionSpecs
          }
        , Cmd.none
        )

    else if model.activeMenuLabel == Just "Center" then
        ( updateView3d View3d.encompass model, Cmd.none )

    else if model.activeMenuLabel == Just "Along X" then
        ( lookAlong (vec3 -1 0 0) (vec3 0 1 0) newModel, Cmd.none )

    else if model.activeMenuLabel == Just "Along Y" then
        ( lookAlong (vec3 0 -1 0) (vec3 0 0 -1) newModel, Cmd.none )

    else if model.activeMenuLabel == Just "Along Z" then
        ( lookAlong (vec3 0 0 -1) (vec3 0 1 0) newModel, Cmd.none )

    else if model.activeMenuLabel == Just "Save Screenshot..." then
        ( updateView3d (View3d.setRedraws True) newModel
        , toJS <| OutData "menuChoice" model.activeMenuLabel [] []
        )

    else if model.activeMenuLabel /= Nothing then
        ( newModel
        , model.viewState.selected
            |> Set.toList
            |> List.map (\( m, i ) -> { meshIndex = m, instanceIndex = i })
            |> OutData "menuChoice" model.activeMenuLabel []
            |> toJS
        )

    else
        ( newModel, Cmd.none )


mainMenuOnOff : Model -> Bool -> Model
mainMenuOnOff model onOff =
    { model
        | mainMenuState = { visible = onOff, active = Nothing }
        , activeMenuLabel = Nothing
    }


mainMenuSetItem : Model -> Maybe ( Int, String ) -> Model
mainMenuSetItem model item =
    let
        state =
            model.mainMenuState
    in
    case item of
        Nothing ->
            { model
                | mainMenuState = { state | active = Nothing }
                , activeMenuLabel = Nothing
            }

        Just ( i, s ) ->
            { model
                | mainMenuState = { state | active = Just i }
                , activeMenuLabel = Just s
            }


contextMenuOnOff : Model -> Maybe Position -> Model
contextMenuOnOff model maybePos =
    case maybePos of
        Nothing ->
            { model
                | contextMenuState = { visible = False, active = Nothing }
                , activeMenuLabel = Nothing
            }

        Just pos ->
            { model
                | contextMenuState = { visible = True, active = Nothing }
                , activeMenuLabel = Nothing
                , contextMenuPosition = pos
            }


contextMenuSetItem : Model -> Maybe ( Int, String ) -> Model
contextMenuSetItem model item =
    let
        state =
            model.contextMenuState
    in
    case item of
        Nothing ->
            { model
                | contextMenuState = { state | active = Nothing }
                , activeMenuLabel = Nothing
            }

        Just ( i, s ) ->
            { model
                | contextMenuState = { state | active = Just i }
                , activeMenuLabel = Just s
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
    in
    case result of
        Nothing ->
            ( { model | optionSpecsTmp = specs }, Cmd.none )

        Just ok ->
            if ok then
                ( { model | visibleDialog = Nothing, optionSpecs = specs }
                , toJS <| OutData "options" Nothing (List.map asJS specs) []
                )

            else
                ( { model | visibleDialog = Nothing }, Cmd.none )


hotKeyActions : Dict Char ( Model -> Model, Cmd Msg )
hotKeyActions =
    Dict.fromList
        [ ( 'n'
          , ( identity, toJS <| OutData "menuChoice" (Just "Next") [] [] )
          )
        , ( 'p'
          , ( identity, toJS <| OutData "menuChoice" (Just "Prev") [] [] )
          )
        , ( '0', ( updateView3d View3d.encompass, Cmd.none ) )
        , ( 'x', ( lookAlong (vec3 -1 0 0) (vec3 0 1 0), Cmd.none ) )
        , ( 'y', ( lookAlong (vec3 0 -1 0) (vec3 0 0 -1), Cmd.none ) )
        , ( 'z', ( lookAlong (vec3 0 0 -1) (vec3 0 1 0), Cmd.none ) )
        , ( 'a', ( lookAlong (vec3 0 -1 -1) (vec3 0 1 0), Cmd.none ) )
        , ( 'b', ( lookAlong (vec3 -1 0 -1) (vec3 0 1 0), Cmd.none ) )
        , ( 'c', ( lookAlong (vec3 0 -1 -1) (vec3 0 1 0), Cmd.none ) )
        , ( 'd', ( lookAlong (vec3 -1 -1 -1) (vec3 0 1 0), Cmd.none ) )
        ]


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
        Just ( action, cmd ) ->
            ( action model, cmd )

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
    { title = "Gavrog For Web"
    , body =
        [ Element.layout
            [ Element.width Element.fill
            , Font.size 16
            , Element.inFront
                (Element.el
                    [ Element.width Element.fill
                    , Element.below <| viewCurrentDialog model
                    ]
                    (viewMain model)
                )
            , Element.inFront (viewContextMenu model)
            ]
            (Element.el
                [ onContextMenu ContextMenu
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


viewMain : Model -> Element.Element Msg
viewMain model =
    Styling.box
        [ Element.width Element.fill
        , Border.widthEach { top = 0, bottom = 1, left = 0, right = 0 }
        ]
        (Element.wrappedRow
            [ Element.width Element.fill
            , Element.spacing 16
            ]
            [ viewMainMenu model
            , Element.image []
                { src = "3dt.ico", description = "Gavrog Logo" }
            , Styling.logoText "Gavrog"
            , Element.column
                [ Element.width Element.fill
                , Element.spacing 8
                ]
                [ Element.el [ Element.centerX ] <| Element.text model.title
                , Element.el [ Element.centerX ] <| Element.text model.status
                ]
            ]
        )


viewMainMenu : Model -> Element.Element Msg
viewMainMenu model =
    let
        maybeMenu =
            if model.mainMenuState.visible then
                Menu.view model.mainMenuConfig model.mainMenuState.active

            else
                Element.none
    in
    Element.el
        [ Element.below maybeMenu
        , Element.Events.onMouseEnter <| MainMenuActivate True
        , Element.Events.onMouseLeave <| MainMenuActivate False
        , Element.pointer
        ]
        Styling.navIcon


viewContextMenu : Model -> Element.Element Msg
viewContextMenu model =
    if model.contextMenuState.visible then
        Element.el
            [ Element.moveDown model.contextMenuPosition.y
            , Element.moveRight model.contextMenuPosition.x
            , onContextMenu ContextMenu
            ]
            (Menu.view model.contextMenuConfig model.contextMenuState.active)

    else
        Element.none


viewCurrentDialog : Model -> Element.Element Msg
viewCurrentDialog model =
    let
        wrap =
            Styling.box
                [ Element.moveDown 128
                , Border.shadow
                    { offset = ( 0.0, 8.0 )
                    , size = 0.0
                    , blur = 16.0
                    , color = Element.rgba 0.0 0.0 0.0 0.2
                    }
                ]
    in
    case model.visibleDialog of
        Nothing ->
            Element.none

        Just About ->
            wrap <|
                viewAbout model

        Just Jump ->
            wrap <|
                viewTextBox model.jumpDialogConfig model.jumpDialogContent

        Just Search ->
            wrap <|
                viewTextBox model.searchDialogConfig model.searchDialogContent

        Just Options ->
            wrap <|
                Options.view OptionsMsg model.optionSpecsTmp


viewAbout : Model -> Element.Element Msg
viewAbout model =
    Element.column
        [ Element.Events.onClick HideAbout
        , Element.spacing 4
        , Element.paddingEach
            { top = 4
            , bottom = 16
            , left = 16
            , right = 16
            }
        ]
        [ Element.row [ Element.spacing 16 ]
            [ Element.image []
                { src = "3dt.ico", description = "Gavrog Logo" }
            , Element.column [ Element.spacing 4, Element.padding 8 ]
                [ Styling.logoText "Gavrog For Web"
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
            , Element.text model.revision
            ]
        , Element.paragraph []
            [ Element.el [ Font.bold ] (Element.text "Timestamp: ")
            , Element.text model.timestamp
            ]
        ]


viewTextBox : TextBoxConfig -> String -> Element.Element Msg
viewTextBox config text =
    Element.column [ Element.spacing 8, Element.padding 16 ]
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
        , Element.row [ Element.spacing 32, Element.centerX ]
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
