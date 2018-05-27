port module TextInput exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onInput)


main =
    Html.beginnerProgram { model = model, view = view, update = update }



-- MODEL


type alias Model =
    { text : String }


model : Model
model =
    Model ""



-- UPDATE


type Msg
    = Text String


update : Msg -> Model -> Model
update msg model =
    case msg of
        Text text ->
            { model | text = text }



-- VIEW


view : Model -> Html Msg
view model =
    div []
        [ input [ type_ "text", placeholder "Text", onInput Text ] []
        ]
