port module MainMenu exposing (main)

import Browser
import Browser.Events as Events
import Char
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onInput, stopPropagationOn)
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
    , Events.onKeyUp (Decode.map KeyUp decodeKey)
    , View3d.subscriptions ViewMsg model.viewState
    , Events.onResize Resize
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


type alias Model =
    { viewState : View3d.Model
    , revision : String
    , timestamp : String
    , menuConfig : Menu.Config Msg
    , menuState : Menu.State
    , activeLabel : Maybe String
    , jumpDialogConfig : TextBoxConfig
    , jumpDialogContent : String
    , jumpDialogVisible : Bool
    , searchDialogConfig : TextBoxConfig
    , searchDialogContent : String
    , searchDialogVisible : Bool
    , optionSpecs : List Options.Spec
    , optionSpecsTmp : List Options.Spec
    , optionsDialogVisible : Bool
    , title : String
    , status : String
    , showAbout : Bool
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
      , title = ""
      , status = "Welcome!"
      , showAbout = False
      , jumpDialogConfig = jumpDialogConfig
      , jumpDialogContent = ""
      , jumpDialogVisible = False
      , searchDialogConfig = searchDialogConfig
      , searchDialogContent = ""
      , searchDialogVisible = False
      , optionSpecs = initOptionSpecs
      , optionSpecsTmp = []
      , optionsDialogVisible = False
      }
    , Cmd.none
      -- Task.perform Resize Window.size
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
            ( { model | showAbout = False }, Cmd.none )

        JumpDialogInput text ->
            ( { model | jumpDialogContent = text }, Cmd.none )

        JumpDialogSubmit ok ->
            ( { model | jumpDialogVisible = False }
            , if ok then
                toJS <| OutData "jump" (Just model.jumpDialogContent) []

              else
                Cmd.none
            )

        SearchDialogInput text ->
            ( { model | searchDialogContent = text }, Cmd.none )

        SearchDialogSubmit ok ->
            ( { model | searchDialogVisible = False }
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
        ( { newModel | showAbout = True }, Cmd.none )

    else if model.activeLabel == Just "Jump..." then
        ( { newModel | jumpDialogVisible = True }, Cmd.none )

    else if model.activeLabel == Just "Search..." then
        ( { newModel | searchDialogVisible = True }, Cmd.none )

    else if model.activeLabel == Just "Options..." then
        ( { newModel
            | optionsDialogVisible = True
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
    case msg of
        Options.Submit ok ->
            if ok then
                ( { model
                    | optionsDialogVisible = False
                    , optionSpecs = model.optionSpecsTmp
                  }
                , toJS <| OutData "options" Nothing model.optionSpecsTmp
                )

            else
                ( { model | optionsDialogVisible = False }, Cmd.none )

        Options.Toggle key ->
            ( { model
                | optionSpecsTmp = Options.toggle key model.optionSpecsTmp
              }
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
        [ div []
            ([ View3d.view ViewMsg model.viewState
             , viewMain model
             ]
                ++ (if model.showAbout then
                        [ viewAbout model ]

                    else
                        []
                   )
                ++ (if model.jumpDialogVisible then
                        [ viewTextBox model.jumpDialogConfig ]

                    else
                        []
                   )
                ++ (if model.searchDialogVisible then
                        [ viewTextBox model.searchDialogConfig ]

                    else
                        []
                   )
                ++ (if model.optionsDialogVisible then
                        [ Options.view OptionsMsg model.optionSpecsTmp ]

                    else
                        []
                   )
            )
        ]
    }


viewMain : Model -> Html Msg
viewMain model =
    div [ class "floatable infoBox" ]
        [ img [ class "infoBoxLogo", width 48, src "3dt.ico" ] []
        , h3 [ class "infoBoxHeader" ] [ text "Gavrog" ]
        , span [ class "clearFix" ]
            [ text model.title
            , br [] []
            , text model.status
            ]
        , Menu.view model.menuConfig model.menuState
        ]


viewAbout : Model -> Html Msg
viewAbout model =
    div
        [ class "floatable centered infoBox"
        , onClick HideAbout
        ]
        [ img [ class "infoBoxLogo", width 48, src "3dt.ico" ] []
        , h3 [ class "infoBoxHeader" ] [ text "Gavrog for the Web" ]
        , span [ class "clearFix" ]
            [ text "by Olaf Delgado-Friedrichs 2018"
            , br [] []
            , text "The Australian National University"
            ]
        , p []
            [ b [] [ text "Version: " ]
            , text "0.0.0 (pre-alpha)"
            , br [] []
            , b [] [ text "Revision: " ]
            , text model.revision
            , br [] []
            , b [] [ text "Timestamp: " ]
            , text model.timestamp
            , br [] []
            ]
        ]


viewTextBox : TextBoxConfig -> Html Msg
viewTextBox config =
    div
        [ class "floatable centered infoBox" ]
        [ div [ class "form-element" ]
            [ label [] [ text config.label ]
            , input
                [ type_ "text"
                , placeholder config.placeholder
                , onInput config.onInput
                , onKeyUp Ignore
                , onKeyDown Ignore
                ]
                []
            , p [ class "form-buttons" ]
                [ button [ onClick (config.onSubmit True) ] [ text "OK" ]
                , button [ onClick (config.onSubmit False) ] [ text "Cancel" ]
                ]
            ]
        ]


onClick : msg -> Attribute msg
onClick msg =
    stopPropagationOn "click" (Decode.map always (Decode.succeed msg))


onKeyUp : msg -> Attribute msg
onKeyUp msg =
    stopPropagationOn "keyup" (Decode.map always (Decode.succeed msg))


onKeyDown : msg -> Attribute msg
onKeyDown msg =
    stopPropagationOn "keydown" (Decode.map always (Decode.succeed msg))


always : msg -> ( msg, Bool )
always msg =
    ( msg, True )
