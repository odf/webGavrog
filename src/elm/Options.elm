port module Options exposing (main)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick)
import Task
import Window


main =
    Html.programWithFlags
        { init = init
        , view = view
        , subscriptions = subscriptions
        , update = update
        }



-- MODEL


type alias Spec =
    { key : String
    , label : String
    , value : Bool
    }


type alias Model =
    { options : List Spec
    , ypos : Int
    , xpos : Int
    }


init : List Spec -> ( Model, Cmd Msg )
init options =
    ( { options = options
      , xpos = 100
      , ypos = 100
      }
    , Task.perform Resize Window.size
    )



-- UPDATE


port send : ( List Spec, Bool ) -> Cmd msg


type Msg
    = Toggle String
    | Send
    | Cancel
    | Resize Window.Size


toggleIfKey : String -> Spec -> Spec
toggleIfKey key spec =
    if spec.key == key then
        { spec | value = not spec.value }
    else
        spec


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Toggle key ->
            { model | options = List.map (toggleIfKey key) model.options } ! []

        Send ->
            ( model, send ( model.options, True ) )

        Cancel ->
            ( model, send ( model.options, False ) )

        Resize size ->
            { model | xpos = size.width // 2, ypos = size.height // 2 } ! []



-- VIEW


view : Model -> Html Msg
view model =
    div
        [ class "floatable infoBox"
        , style
            [ ( "left", toString model.xpos ++ "px" )
            , ( "top", toString model.ypos ++ "px" )
            , ( "transform", "translate(-50%, -50%)" )
            ]
        ]
        [ fieldset [ class "form-section" ]
            (List.map checkbox model.options
                ++ [ p [ class "form-buttons" ]
                        [ button [ onClick Send ] [ text "OK" ]
                        , button [ onClick Cancel ] [ text "Cancel" ]
                        ]
                   ]
            )
        ]


checkbox : Spec -> Html Msg
checkbox spec =
    div [ class "form-element" ]
        [ label [] [ text spec.label ]
        , input
            [ type_ "checkbox"
            , checked spec.value
            , onClick (Toggle spec.key)
            ]
            []
        ]



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch [ Window.resizes Resize ]
