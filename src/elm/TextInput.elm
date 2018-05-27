port module TextInput exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onInput, onClick)


main =
    Html.programWithFlags
        { init = init
        , view = view
        , subscriptions = subscriptions
        , update = update
        }


port send : String -> Cmd msg



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
    | Send


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Text text ->
            { model | text = text } ! []

        Send ->
            ( model, send model.text )



-- VIEW


view : Model -> Html Msg
view model =
    div [ class "form-element" ]
        [ label [] [ text model.label ]
        , input
            [ type_ "text"
            , placeholder model.placeholder
            , onInput Text
            ]
            []
        , button [ onClick Send ] [ text "OK" ]
        ]



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch []
