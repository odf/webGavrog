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
    | Cancel


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Text text ->
            { model | text = text } ! []

        Send ->
            ( model, send model.text )

        Cancel ->
            ( { model | text = "" }, send "" )



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
        , p [ class "form-buttons" ]
            [ button [ onClick Send ] [ text "OK" ]
            , button [ onClick Cancel ] [ text "Cancel" ]
            ]
        ]



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch []
