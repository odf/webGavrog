port module MainMenu exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
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



-- SUBSCRIPTIONS


port titles : (String -> msg) -> Sub msg


port log : (String -> msg) -> Sub msg


port send : Maybe String -> Cmd msg


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.batch
        [ titles SetTitle
        , log SetStatus
        ]



-- MODEL


type alias Model =
    { menuConfig : Menu.Config Msg
    , menuState : Menu.State
    , activeLabel : Maybe String
    , title : String
    , status : String
    }


init : List Menu.ItemSpec -> ( Model, Cmd Msg )
init items =
    { menuConfig =
        { classes = initClasses
        , actions = initActions
        , items = items
        }
    , menuState = initState
    , activeLabel = Nothing
    , title = ""
    , status = "Welcome!"
    }
        ! []


initClasses : Menu.Classes
initClasses =
    { menu = "infoBoxMenu"
    , item = "infoBoxMenuItem"
    , submenu = "infoBoxMenuSubmenu"
    , subitem = "infoBoxMenuSubmenuItem"
    , highlight = "infoBoxMenuHighlight"
    }


initActions : Menu.Actions Msg
initActions =
    { activateTopItem = Activate
    , activateSubItem = ActivateSub
    , selectCurrentItem = Select
    }


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
            ( { model | menuState = initState }
            , send <| model.activeLabel
            )

        SetTitle title ->
            { model | title = title } ! []

        SetStatus status ->
            { model | status = status } ! []


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



-- VIEW


view : Model -> Html Msg
view model =
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
