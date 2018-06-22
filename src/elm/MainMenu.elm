port module MainMenu exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onWithOptions)
import Json.Decode as Json
import Menu


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
    | SetTitle String
    | SetStatus String
    | HideAbout



-- SUBSCRIPTIONS


port titles : (String -> msg) -> Sub msg


port log : (String -> msg) -> Sub msg


port menuSelection : Maybe String -> Cmd msg


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


type alias Model =
    { revision : String
    , timestamp : String
    , menuConfig : Menu.Config Msg
    , menuState : Menu.State
    , activeLabel : Maybe String
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
            Just
                [ "Open..."
                , "Save Structure..."
                , "Save Screenshot..."
                ]
      }
    , { label = "Structure"
      , submenu =
            Just
                [ "First"
                , "Prev"
                , "Next"
                , "Last"
                , "Jump..."
                , "Search..."
                ]
      }
    , { label = "View"
      , submenu =
            Just
                [ "Center"
                , "Along X"
                , "Along Y"
                , "Along Z"
                ]
      }
    , { label = "Options..."
      , submenu =
            Nothing
      }
    , { label = "Help"
      , submenu =
            Just
                [ "About Gavrog..."
                ]
      }
    ]


initState : Menu.State
initState =
    { active = Nothing
    , activeSub = Nothing
    }



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
        else
            ( newModel, menuSelection model.activeLabel )



-- VIEW


view : Model -> Html Msg
view model =
    div []
        [ viewMain model
        , if model.showAbout then
            viewAbout model
          else
            span [] []
        ]


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


onClick : msg -> Attribute msg
onClick msg =
    onWithOptions
        "click"
        { stopPropagation = True
        , preventDefault = False
        }
        (Json.succeed msg)
