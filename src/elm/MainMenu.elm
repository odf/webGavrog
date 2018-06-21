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


type Msg
    = Activate (Maybe Int)
    | ActivateSub (Maybe Int)
    | Select



-- MODEL


type alias Model =
    { config : Menu.Config Msg
    , state : Menu.State
    }


type alias Flags =
    { classes : Menu.Classes
    , items : List Menu.ItemSpec
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    { config =
        { classes = flags.classes
        , actions = initActions
        , items = flags.items
        }
    , state = initState
    }
        ! []


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


port send : ( Maybe Int, Maybe Int ) -> Cmd msg


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
