port module TextInput exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onInput)


main =
    Html.programWithFlags
        { init = init
        , view = view
        , subscriptions = subscriptions
        , update = update
        }



-- MODEL


type alias Flags =
    { label : String
    , placeholder : String
    }


type alias Model =
    { label : String
    , placeholder : String
    , text : String
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    Model flags.label flags.placeholder "" ! []



-- UPDATE


type Msg
    = Text String


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Text text ->
            { model | text = text } ! []



-- VIEW


view : Model -> Html Msg
view model =
    div []
        [ text model.label
        , input
            [ type_ "text"
            , placeholder model.placeholder
            , onInput Text
            ]
            []
        ]



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch []
