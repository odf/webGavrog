port module MainMenu exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onInput, onWithOptions)
import Json.Decode as Json
import Menu
import Options


main =
    Html.programWithFlags
        { init = init
        , update = update
        , view = view
        , subscriptions = subscriptions
        }


type Msg
    = Activate (Maybe ( Int, String ))
    | ActivateSub (Maybe ( Int, String ))
    | Select
    | JumpDialogInput String
    | JumpDialogSubmit Bool
    | SearchDialogInput String
    | SearchDialogSubmit Bool
    | OptionsMsg Options.Msg
    | SetTitle String
    | SetStatus String
    | HideAbout
    | Ignore



-- SUBSCRIPTIONS


port titles : (String -> msg) -> Sub msg


port log : (String -> msg) -> Sub msg


port menuSelection : Maybe String -> Cmd msg


port jumpTo : String -> Cmd msg


port search : String -> Cmd msg


port options : List Options.Spec -> Cmd msg


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.batch
        [ titles SetTitle
        , log SetStatus
        ]



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
    { revision : String
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
    { revision = flags.revision
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
        ! []


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
        Activate item ->
            updateActive model item ! []

        ActivateSub item ->
            updateActiveSub model item ! []

        Select ->
            handleSelection model

        SetTitle title ->
            { model | title = title } ! []

        SetStatus status ->
            { model | status = status } ! []

        HideAbout ->
            { model | showAbout = False } ! []

        JumpDialogInput text ->
            { model | jumpDialogContent = text } ! []

        JumpDialogSubmit ok ->
            ( { model | jumpDialogVisible = False }
            , if ok then
                jumpTo model.jumpDialogContent
              else
                Cmd.none
            )

        SearchDialogInput text ->
            { model | searchDialogContent = text } ! []

        SearchDialogSubmit ok ->
            ( { model | searchDialogVisible = False }
            , if ok then
                search model.searchDialogContent
              else
                Cmd.none
            )

        OptionsMsg msg ->
            updateOptions model msg

        Ignore ->
            model ! []


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
            { newModel | showAbout = True } ! []
        else if model.activeLabel == Just "Jump..." then
            { newModel | jumpDialogVisible = True } ! []
        else if model.activeLabel == Just "Search..." then
            { newModel | searchDialogVisible = True } ! []
        else if model.activeLabel == Just "Options..." then
            { newModel
                | optionsDialogVisible = True
                , optionSpecsTmp = model.optionSpecs
            }
                ! []
        else
            ( newModel, menuSelection model.activeLabel )


updateOptions : Model -> Options.Msg -> ( Model, Cmd Msg )
updateOptions model msg =
    case msg of
        Options.Submit ok ->
            if ok then
                ( { model
                    | optionsDialogVisible = False
                    , optionSpecs = model.optionSpecsTmp
                  }
                , options model.optionSpecsTmp
                )
            else
                { model | optionsDialogVisible = False } ! []

        Options.Toggle key ->
            { model
                | optionSpecsTmp = Options.toggle key model.optionSpecsTmp
            }
                ! []



-- VIEW


view : Model -> Html Msg
view model =
    div []
        ([ viewMain model ]
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
    onWithOptions
        "click"
        { stopPropagation = True
        , preventDefault = False
        }
        (Json.succeed msg)


onKeyUp : msg -> Attribute msg
onKeyUp msg =
    onWithOptions
        "keyup"
        { stopPropagation = True
        , preventDefault = False
        }
        (Json.succeed msg)


onKeyDown : msg -> Attribute msg
onKeyDown msg =
    onWithOptions
        "keydown"
        { stopPropagation = True
        , preventDefault = False
        }
        (Json.succeed msg)
