port module MainMenu exposing (main)

import Html exposing (Html)
import Menu


main =
    Html.programWithFlags
        { init = init
        , update = update
        , view = view
        , subscriptions = \_ -> Sub.none
        }


port send : ( Maybe Int, Maybe Int ) -> Cmd msg



-- MODEL


type alias Model =
    { config : Menu.Config Msg
    , state : Menu.State
    }


init : List Menu.ItemSpec -> ( Model, Cmd Msg )
init items =
    { config =
        { classes = initClasses
        , actions = initActions
        , items = items
        }
    , state = initState
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


type Msg
    = Activate (Maybe Int)
    | ActivateSub (Maybe Int)
    | Select


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    let
        state =
            model.state
    in
        case msg of
            Activate i ->
                { model | state = { state | active = i } } ! []

            ActivateSub i ->
                { model | state = { state | activeSub = i } } ! []

            Select ->
                ( { model | state = initState }
                , send ( state.active, state.activeSub )
                )



-- VIEW


view : Model -> Html Msg
view model =
    Menu.view model.config model.state
