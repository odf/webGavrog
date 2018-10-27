module Menu exposing (Actions, Config, State, view)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onMouseEnter, onMouseLeave, stopPropagationOn)
import Json.Decode as Decode



-- MODEL


type alias Actions msg =
    { activate : Bool -> msg
    , activateItem : Maybe ( Int, String ) -> msg
    , selectCurrentItem : msg
    }


type alias Config msg =
    { actions : Actions msg
    , items : List String
    }


type alias State =
    { visible : Bool
    , active : Maybe Int
    }



-- VIEW


view : Config msg -> State -> Html msg
view config state =
    let
        maybeMenu =
            if state.visible then
                [ ul [ class "infoBoxMenuSubmenu" ]
                    (List.indexedMap (viewSubItem config state) config.items)
                ]

            else
                []
    in
    ul
        [ class "infoBoxMenu" ]
        [ li
            [ class "infoBoxMenuItem"
            , onMouseEnter <| config.actions.activate True
            , onMouseLeave <| config.actions.activate False
            ]
            ([ text "Menu" ] ++ maybeMenu)
        ]


viewSubItem : Config msg -> State -> Int -> String -> Html msg
viewSubItem config state index label =
    li
        [ classList
            [ ( "infoBoxMenuSubmenuItem", True )
            , ( "infoBoxMenuHighlight", state.active == Just index )
            ]
        , onMouseEnter <| config.actions.activateItem (Just ( index, label ))
        , onMouseLeave <| config.actions.activateItem Nothing
        , onClick config.actions.selectCurrentItem
        ]
        [ text label ]


onClick : msg -> Attribute msg
onClick msg =
    stopPropagationOn "click" (Decode.map always (Decode.succeed msg))


always : msg -> ( msg, Bool )
always msg =
    ( msg, True )
