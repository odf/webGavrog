port module MainMenu exposing (main)

import Browser
import Browser.Dom as Dom
import Browser.Events
import Char
import Element
import Element.Background as Background
import Element.Border as Border
import Element.Events
import Element.Font as Font
import Element.Input as Input
import Json.Decode as Decode
import Math.Vector3 as Vec3 exposing (Vec3, vec3)
import Menu
import Options
import Scene exposing (RawSceneSpec)
import Task
import View3d


main =
    Browser.document
        { init = init
        , update = update
        , view = view
        , subscriptions = subscriptions
        }


type alias OutData =
    { mode : String
    , text : Maybe String
    , options : List Options.Spec
    }


type alias InData =
    { title : Maybe String
    , log : Maybe String
    , scene : Maybe RawSceneSpec
    }


type Msg
    = Resize Int Int
    | ViewMsg View3d.Msg
    | Activate (Maybe ( Int, String ))
    | ActivateSub (Maybe ( Int, String ))
    | Select
    | JumpDialogInput String
    | JumpDialogSubmit Bool
    | SearchDialogInput String
    | SearchDialogSubmit Bool
    | OptionsMsg Options.Msg
    | JSData InData
    | HideAbout
    | KeyUp Int
    | Ignore


port toJS : OutData -> Cmd msg


port fromJS : (InData -> msg) -> Sub msg



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    let
        decodeKey =
            Decode.at [ "keyCode" ] Decode.int
    in
    [ fromJS JSData
    , Browser.Events.onKeyUp (Decode.map KeyUp decodeKey)
    , View3d.subscriptions ViewMsg model.viewState
    , Browser.Events.onResize Resize
    ]
        |> Sub.batch



-- MODEL


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
    = About
    | Jump
    | Search
    | Options


type alias Model =
    { viewState : View3d.Model
    , revision : String
    , timestamp : String
    , menuConfig : Menu.Config Msg
    , menuState : Menu.State
    , activeLabel : Maybe String
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
      , menuConfig =
            { actions = initActions
            , items = initItems
            }
      , menuState = initState
      , activeLabel = Nothing
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


initActions : Menu.Actions Msg
initActions =
    { activateTopItem = Activate
    , activateSubItem = ActivateSub
    , selectCurrentItem = Select
    }


initItems : List Menu.ItemSpec
initItems =
    [ { label = "File"
      , submenu =
            Just [ "Open...", "Save Structure...", "Save Screenshot..." ]
      }
    , { label = "Structure"
      , submenu =
            Just [ "First", "Prev", "Next", "Last", "Jump...", "Search..." ]
      }
    , { label = "View"
      , submenu =
            Just [ "Center", "Along X", "Along Y", "Along Z" ]
      }
    , { label = "Options..."
      , submenu =
            Nothing
      }
    , { label = "Help"
      , submenu =
            Just [ "About Gavrog..." ]
      }
    ]


initState : Menu.State
initState =
    { active = Nothing
    , activeSub = Nothing
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
      , value = False
      }
    , { key = "skipRelaxation"
      , label = "Skip Relaxation"
      , value = False
      }
    , { key = "extraSmooth"
      , label = "Extra-Smooth Faces"
      , value = False
      }
    , { key = "showSurfaceMesh"
      , label = "Show Surface Mesh"
      , value = False
      }
    ]



-- UPDATE


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Resize width height ->
            ( updateView3d (View3d.setSize { width = width, height = height })
                model
            , Cmd.none
            )

        ViewMsg viewMsg ->
            ( updateView3d (View3d.update viewMsg) model, Cmd.none )

        Activate item ->
            ( updateActive model item, Cmd.none )

        ActivateSub item ->
            ( updateActiveSub model item, Cmd.none )

        Select ->
            handleSelection model

        JSData data ->
            ( handleJSData data model, Cmd.none )

        HideAbout ->
            ( { model | visibleDialog = Nothing }, Cmd.none )

        JumpDialogInput text ->
            ( { model | jumpDialogContent = text }, Cmd.none )

        JumpDialogSubmit ok ->
            ( { model | visibleDialog = Nothing }
            , if ok then
                toJS <| OutData "jump" (Just model.jumpDialogContent) []

              else
                Cmd.none
            )

        SearchDialogInput text ->
            ( { model | searchDialogContent = text }, Cmd.none )

        SearchDialogSubmit ok ->
            ( { model | visibleDialog = Nothing }
            , if ok then
                toJS <| OutData "search" (Just model.searchDialogContent) []

              else
                Cmd.none
            )

        OptionsMsg optionMsg ->
            updateOptions model optionMsg

        KeyUp code ->
            handleKeyPress code model

        Ignore ->
            ( model, Cmd.none )


updateView3d : (View3d.Model -> View3d.Model) -> Model -> Model
updateView3d fn model =
    { model | viewState = fn model.viewState }


updateActive : Model -> Maybe ( Int, String ) -> Model
updateActive model item =
    let
        state =
            model.menuState
    in
    case item of
        Nothing ->
            { model
                | menuState = initState
                , activeLabel = Nothing
            }

        Just ( i, s ) ->
            { model
                | menuState =
                    { state
                        | active = Just i
                        , activeSub = Nothing
                    }
                , activeLabel = Just s
            }


updateActiveSub : Model -> Maybe ( Int, String ) -> Model
updateActiveSub model item =
    let
        state =
            model.menuState
    in
    case item of
        Nothing ->
            { model
                | menuState = { state | activeSub = Nothing }
                , activeLabel = Nothing
            }

        Just ( i, s ) ->
            { model
                | menuState = { state | activeSub = Just i }
                , activeLabel = Just s
            }


handleSelection : Model -> ( Model, Cmd Msg )
handleSelection model =
    let
        newModel =
            { model | menuState = initState }
    in
    if model.activeLabel == Just "About Gavrog..." then
        ( { newModel | visibleDialog = Just About }, Cmd.none )

    else if model.activeLabel == Just "Jump..." then
        ( { newModel | visibleDialog = Just Jump }, Cmd.none )

    else if model.activeLabel == Just "Search..." then
        ( { newModel | visibleDialog = Just Search }, Cmd.none )

    else if model.activeLabel == Just "Options..." then
        ( { newModel
            | visibleDialog = Just Options
            , optionSpecsTmp = model.optionSpecs
          }
        , Cmd.none
        )

    else if model.activeLabel == Just "Center" then
        ( updateView3d View3d.encompass model, Cmd.none )

    else if model.activeLabel == Just "Along X" then
        ( lookAlong (vec3 -1 0 0) (vec3 0 1 0) newModel, Cmd.none )

    else if model.activeLabel == Just "Along Y" then
        ( lookAlong (vec3 0 -1 0) (vec3 0 0 -1) newModel, Cmd.none )

    else if model.activeLabel == Just "Along Z" then
        ( lookAlong (vec3 0 0 -1) (vec3 0 1 0) newModel, Cmd.none )

    else if model.activeLabel == Just "Save Screenshot..." then
        ( updateView3d (View3d.setRedraws True) newModel
        , toJS <| OutData "selected" model.activeLabel []
        )

    else
        ( newModel, toJS <| OutData "selected" model.activeLabel [] )


handleJSData : InData -> Model -> Model
handleJSData data model =
    updateView3d (View3d.setRedraws False) model
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


updateOptions : Model -> Options.Msg -> ( Model, Cmd Msg )
updateOptions model msg =
    let
        specsTmp =
            model.optionSpecsTmp
    in
    case msg of
        Options.Submit ok ->
            if ok then
                ( { model | visibleDialog = Nothing, optionSpecs = specsTmp }
                , toJS <| OutData "options" Nothing specsTmp
                )

            else
                ( { model | visibleDialog = Nothing }, Cmd.none )

        Options.Toggle onOff key ->
            ( { model | optionSpecsTmp = Options.toggle onOff key specsTmp }
            , Cmd.none
            )


handleKeyPress : Int -> Model -> ( Model, Cmd Msg )
handleKeyPress code model =
    let
        char =
            Char.toLower <| Char.fromCode code
    in
    case char of
        'n' ->
            ( model, toJS <| OutData "selected" (Just "Next") [] )

        'p' ->
            ( model, toJS <| OutData "selected" (Just "Prev") [] )

        '0' ->
            ( updateView3d View3d.encompass model, Cmd.none )

        'x' ->
            ( lookAlong (vec3 -1 0 0) (vec3 0 1 0) model, Cmd.none )

        'y' ->
            ( lookAlong (vec3 0 -1 0) (vec3 0 0 -1) model, Cmd.none )

        'z' ->
            ( lookAlong (vec3 0 0 -1) (vec3 0 1 0) model, Cmd.none )

        'a' ->
            ( lookAlong (vec3 0 -1 -1) (vec3 0 1 0) model, Cmd.none )

        'b' ->
            ( lookAlong (vec3 -1 0 -1) (vec3 0 1 0) model, Cmd.none )

        'c' ->
            ( lookAlong (vec3 0 -1 -1) (vec3 0 1 0) model, Cmd.none )

        'd' ->
            ( lookAlong (vec3 -1 -1 -1) (vec3 0 1 0) model, Cmd.none )

        _ ->
            ( model, Cmd.none )


lookAlong : Vec3 -> Vec3 -> Model -> Model
lookAlong axis up model =
    updateView3d (View3d.lookAlong axis up) model



-- VIEW


view : Model -> Browser.Document Msg
view model =
    { title = "Gavrog For The Web"
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
            ]
            (Element.html <| View3d.view ViewMsg model.viewState)
        ]
    }


viewMain : Model -> Element.Element Msg
viewMain model =
    viewBox [ Element.width Element.fill ] <|
        Element.wrappedRow
            [ Element.width Element.fill
            , Element.spacing 16
            ]
            [ Element.image []
                { src = "3dt.ico", description = "Gavrog Logo" }
            , Element.el
                [ Font.size 32
                , Font.color <| Element.rgb255 0 0 139
                , Font.variant Font.smallCaps
                , Font.semiBold
                ]
                (Element.text "Gavrog")
            , Element.html <|
                Menu.view model.menuConfig model.menuState
            , Element.column []
                [ Element.text model.title
                , Element.text model.status
                ]
            ]


viewCurrentDialog : Model -> Element.Element Msg
viewCurrentDialog model =
    let
        wrap =
            viewBox [ Element.moveDown 128 ]
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


viewBox :
    List (Element.Attribute Msg)
    -> Element.Element Msg
    -> Element.Element Msg
viewBox customAttributes content =
    let
        defaultAttributes =
            [ Background.color <| Element.rgb255 255 244 210
            , Border.solid
            , Border.width 1
            , Border.color <| Element.rgb255 170 170 170
            , Element.centerX
            , Element.paddingXY 32 4
            ]
    in
    Element.el (defaultAttributes ++ customAttributes) content


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
                [ Element.el
                    [ Font.size 32
                    , Font.color <| Element.rgb255 0 0 139
                    , Font.variant Font.smallCaps
                    , Font.semiBold
                    ]
                    (Element.text "Gavrog for the Web")
                , Element.text "by Olaf Delgado-Friedrichs 2018"
                , Element.text "The Australian National University"
                ]
            ]
        , Element.paragraph []
            [ Element.el [ Font.bold ] (Element.text "Version: ")
            , Element.text "0.0.0 (pre-alpha)"
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
    let
        -- TODO extract code common with Options.elm
        buttonStyle =
            [ Background.color <| Element.rgb255 140 140 140
            , Font.color <| Element.rgb255 255 255 255
            , Font.semiBold
            , Element.width <| Element.px 96
            , Element.paddingXY 16 8
            , Border.rounded 16
            ]

        buttonText content =
            Element.el [ Element.centerX ] (Element.text content)

        buttonRow =
            Element.row [ Element.spacing 32, Element.centerX ]
                [ Input.button buttonStyle
                    { onPress = Just (config.onSubmit True)
                    , label = buttonText "OK"
                    }
                , Input.button buttonStyle
                    { onPress = Just (config.onSubmit False)
                    , label = buttonText "Cancel"
                    }
                ]
    in
    Element.column [ Element.spacing 8, Element.padding 16 ]
        [ Input.text
            []
            { onChange = config.onInput
            , text = text
            , placeholder =
                Just <|
                    Input.placeholder [] <|
                        Element.text config.placeholder
            , label = Input.labelAbove [] <| Element.text config.label
            }
        , buttonRow
        ]
